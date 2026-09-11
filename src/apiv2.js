// Client for the Fimfiction API v2 (a JSON:API service, see
// https://www.fimfiction.net/developers/api/v2/docs). It is used by the
// command line tool when an API token is available, because Fimfiction's HTML
// pages and story downloads sit behind Cloudflare's bot protection and can no
// longer be fetched outside of a browser. The results are normalized to the
// same shape as the legacy v1 API (/api/story.php) that the rest of the code
// expects.

const API_BASE = 'https://www.fimfiction.net/api/v2'
const SITE = 'https://www.fimfiction.net'

const STORY_FIELDS = [
  'title', 'short_description', 'description_html', 'date_modified', 'date_published',
  'date_updated', 'content_rating', 'completion_status', 'cover_image', 'num_words',
  'num_chapters', 'status', 'published', 'author', 'chapters', 'tags', 'prequel', 'url'
]
const CHAPTER_META_FIELDS = ['chapter_number', 'title', 'published', 'date_modified', 'date_published', 'num_words', 'url']
const CHAPTER_CONTENT_FIELDS = ['content_html', 'authors_note_html', 'authors_note_position']
const TAG_FIELDS = ['name', 'type', 'url']
const USER_FIELDS = ['name', 'url']

const CONTENT_RATINGS = {
  everyone: { content_rating: 0, content_rating_text: 'Everyone' },
  teen: { content_rating: 1, content_rating_text: 'Teen' },
  mature: { content_rating: 2, content_rating_text: 'Mature' }
}

const COMPLETION_STATUS = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  hiatus: 'On Hiatus',
  cancelled: 'Cancelled'
}

export class FimfictionApiError extends Error {
  constructor (message, status) {
    super(message)
    this.name = 'FimfictionApiError'
    this.status = status
  }
}

function describeErrors (json, response) {
  if (json && Array.isArray(json.errors) && json.errors.length > 0) {
    return json.errors.map((e) => [e.title, e.detail].filter(Boolean).join(': ')).join('; ')
  }
  return 'HTTP ' + response.status + ' ' + response.statusText
}

async function apiRequest (path, token, params = {}) {
  const url = new URL(API_BASE + path)
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]))
  const response = await globalThis.fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: 'Bearer ' + token,
      accept: 'application/vnd.api+json, application/json'
    }
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch (err) {}
  if (!response.ok) {
    throw new FimfictionApiError('Fimfiction API request ' + path + ' failed (' + describeErrors(json, response) + ')', response.status)
  }
  if (!json || typeof json !== 'object') {
    throw new FimfictionApiError('Fimfiction API request ' + path + ' returned invalid JSON', response.status)
  }
  return json
}

// Exchange the client id and secret of a Fimfiction API application
// (https://www.fimfiction.net/developers/apps) for a bearer token.
export async function requestToken (clientId, clientSecret) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  })
  const response = await globalThis.fetch(API_BASE + '/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: body.toString()
  })
  let json = null
  try {
    json = await response.json()
  } catch (err) {}
  if (!response.ok || !json || !json.access_token) {
    throw new FimfictionApiError('Unable to obtain a Fimfiction API token (' + describeErrors(json, response) + ')', response.status)
  }
  return json.access_token
}

function toUnixTime (value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const time = Date.parse(value)
  return isNaN(time) ? 0 : Math.floor(time / 1000)
}

function attributesOf (resource) {
  return (resource && resource.attributes) || {}
}

function normalizeStory (document) {
  const included = new Map()
  ;(document.included || []).forEach((resource) => {
    included.set(resource.type + ':' + resource.id, resource)
  })
  const resolve = (ref) => (ref ? included.get(ref.type + ':' + ref.id) : null)
  const resolveAll = (relationship) => ((relationship && relationship.data) || []).map(resolve).filter(Boolean)

  const story = document.data
  if (!story || story.type !== 'story') {
    throw new FimfictionApiError('Fimfiction API did not return a story')
  }
  const attrs = attributesOf(story)
  const relationships = story.relationships || {}
  const storyId = parseInt(story.id, 10)
  const storyUrl = attrs.url || (SITE + '/story/' + storyId)

  const authorResource = resolve(relationships.author && relationships.author.data)
  const authorAttrs = attributesOf(authorResource)
  const author = {
    id: authorResource ? parseInt(authorResource.id, 10) : 0,
    name: authorAttrs.name || 'Unknown',
    url: authorAttrs.url || (authorResource ? SITE + '/user/' + authorResource.id : SITE)
  }

  const chapters = resolveAll(relationships.chapters)
    .filter((chapter) => attributesOf(chapter).published !== false)
    .sort((a, b) => (attributesOf(a).chapter_number || 0) - (attributesOf(b).chapter_number || 0))
    .map((chapter, index) => {
      const c = attributesOf(chapter)
      const number = c.chapter_number || index + 1
      return {
        id: parseInt(chapter.id, 10),
        title: c.title || 'Chapter ' + number,
        link: c.url || (storyUrl.replace(/\/story\/(\d+)(\/.*)?$/, '/story/$1/' + number + '$2')),
        date_modified: toUnixTime(c.date_modified || c.date_published),
        words: c.num_words || 0,
        content: typeof c.content_html === 'string' ? c.content_html : null,
        notes: typeof c.authors_note_html === 'string' ? c.authors_note_html : '',
        notesFirst: c.authors_note_position === 'top'
      }
    })

  const tags = resolveAll(relationships.tags).map((tag) => {
    const t = attributesOf(tag)
    const type = t.type || 'genre'
    return {
      name: t.name || '',
      type,
      url: t.url || (SITE + '/tag/' + encodeURIComponent((t.name || '').toLowerCase())),
      className: 'story-tag tag-' + type
    }
  })

  const rating = CONTENT_RATINGS[attrs.content_rating] || CONTENT_RATINGS.everyone
  const cover = attrs.cover_image || {}
  const prequelRef = relationships.prequel && relationships.prequel.data

  return {
    id: storyId,
    title: attrs.title || 'Untitled',
    url: storyUrl,
    short_description: attrs.short_description || '',
    description: attrs.description_html || '',
    author,
    content_rating: rating.content_rating,
    content_rating_text: rating.content_rating_text,
    status: COMPLETION_STATUS[attrs.completion_status] || 'Incomplete',
    date_modified: toUnixTime(attrs.date_modified || attrs.date_updated || attrs.date_published),
    publishDate: toUnixTime(attrs.date_published) || undefined,
    image: cover.medium || cover.full || cover.large || '',
    full_image: cover.full || cover.large || cover.medium || '',
    words: attrs.num_words || 0,
    chapter_count: chapters.length,
    chapters,
    tags,
    prequel: prequelRef ? { id: parseInt(prequelRef.id, 10), url: SITE + '/story/' + prequelRef.id, title: '' } : null
  }
}

// Fetch a story with its author, tags and chapters (including chapter
// contents unless includeContent is false).
export async function fetchStoryV2 (storyId, token, { includeContent = true } = {}) {
  const chapterFields = includeContent ? CHAPTER_META_FIELDS.concat(CHAPTER_CONTENT_FIELDS) : CHAPTER_META_FIELDS
  const document = await apiRequest('/stories/' + storyId, token, {
    include: 'author,chapters,tags',
    'fields[story]': STORY_FIELDS.join(','),
    'fields[chapter]': chapterFields.join(','),
    'fields[story_tag]': TAG_FIELDS.join(','),
    'fields[user]': USER_FIELDS.join(',')
  })
  const story = normalizeStory(document)
  if (story.prequel) {
    try {
      const prequel = await apiRequest('/stories/' + story.prequel.id, token, { 'fields[story]': 'title,url' })
      const attrs = attributesOf(prequel.data)
      story.prequel.title = attrs.title || ''
      story.prequel.url = attrs.url || story.prequel.url
    } catch (err) {
      // the prequel may be unpublished or deleted; the link still works
      story.prequel.title = story.prequel.title || 'Story ' + story.prequel.id
    }
  }
  return story
}
