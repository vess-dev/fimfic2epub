// End-to-end test of the built Node library (dist/fimfic2epub.js) with a
// mocked network: legacy (v1 API + website scraping) path, API v2 path,
// option variants, generated cover, and error handling. The generated EPUB
// files can be validated with epubcheck afterwards.
const path = require('path')
const fs = require('fs')
const assert = require('assert')

const os = require('os')

// Run `npm run build` first. Usage: node test/e2e-node.js [output dir]
const ROOT = path.join(__dirname, '..')
const OUT = process.argv[2] || path.join(os.tmpdir(), 'fimfic2epub-e2e')
fs.mkdirSync(OUT, { recursive: true })

const { createCanvas } = require(path.join(ROOT, 'node_modules/@napi-rs/canvas'))
function makeImage (w, h, color, mime) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  return c.toBuffer(mime)
}
const coverJpeg = makeImage(600, 800, '#3366cc', 'image/jpeg')
const imagePng = makeImage(200, 100, '#cc3333', 'image/png')
const brokenPng = makeImage(50, 50, '#999999', 'image/png')
const emoticonPng = makeImage(20, 20, '#33cc33', 'image/png')
const emojiSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="purple"/></svg>')
const svgImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')

const STORY = 289663
const v1Story = {
  story: {
    id: STORY,
    title: 'Summer Island',
    url: 'https://www.fimfiction.net/story/289663/summer-island',
    short_description: 'Short desc.',
    description: '[i]bbcode[/i] desc',
    date_modified: 1466571163,
    image: 'https://cdn-img.fimfiction.net/story/x-medium',
    full_image: 'https://cdn-img.fimfiction.net/story/x-full',
    views: 1,
    total_views: 2,
    words: 12,
    chapter_count: 2,
    comments: 0,
    author: { id: 1, name: 'djazz', url: 'https://www.fimfiction.net/user/1/djazz' },
    likes: 1,
    dislikes: 0,
    status: 'On Hiatus',
    content_rating: 0,
    content_rating_text: 'Everyone',
    chapters: [
      { id: 1, title: 'Chapter One', words: 6, views: 1, link: 'https://www.fimfiction.net/story/289663/1/summer-island/chapter-one', date_modified: 1466571163 },
      { id: 2, title: 'Chapter Two: "Quotes" & Ampersands', words: 6, views: 1, link: 'https://www.fimfiction.net/story/289663/2/summer-island/chapter-two', date_modified: 1466571200 }
    ]
  }
}

const storyPage = '<html><body><div class="story_content_box"><ul class="story-tags"><li><a href="/tag/adventure" class="tag-genre" title="Adventure stories" data-tag="adventure">Adventure</a></li><li><a href="/tag/scootaloo" class="tag-character" title="Scootaloo" data-tag="scootaloo">Scootaloo</a></li></ul>' +
  '<span class="description-text bbcode">This story is a sequel to <a href="/story/1/the-prequel">The Prequel</a><hr /><p>A <b>description</b> with an emoji 🦄.</p></span>\n' +
  '<div class="extra_story_data"><span class="approved-date">Published <span data-time="1466571000">27th Jun 2016</span></span><div class="button-group"></div></div></div></body></html>'

const chapterOne = '<p>First paragraph with an image <img src="https://cdn-img.fimfiction.net/user/img1.png" /> and emoji 🦄 and a link <a href="/user/1/djazz" rel="nofollow">djazz</a>.</p>\n<p>Second paragraph <b>bold</b> <i>italic</i> "quotes" &amp; ampersand... Mr. Smith said 1/2 of it.</p>'
const chapterTwo = '<p>Chapter two text <img src="https://static.fimfiction.net/images/emoticons/twilightsmile.png" /> with an svg <img src="https://example.com/vector.svg" />.</p>\n<p><a class="embed" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></p>'
const noteOne = '<p>Thanks for reading! <img src="https://example.com/broken1.png" /></p>'
const noteTwo = '<p>Note at the top <img src="https://example.com/broken2.png" /></p>'

const downloadHtml = '<!DOCTYPE html><html><head><title>Summer Island</title></head><body>\n' +
  '<article class="chapter"><header><h1>Chapter One</h1></header>\n' + chapterOne + '\n' +
  '<aside class="authors-note"><header><h1>Author\'s Note</h1></header>' + noteOne + '</aside>\n<footer><p>footer</p></footer></article>\n' +
  '<article class="chapter"><header><h1>Chapter Two</h1></header>\n' +
  '<aside class="authors-note"><header><h1>Author\'s Note</h1></header>' + noteTwo + '</aside>\n' + chapterTwo + '\n<footer></footer></article>\n</body></html>'

const v2Doc = {
  data: {
    type: 'story',
    id: String(STORY),
    attributes: {
      title: 'Summer Island',
      short_description: 'Short desc.',
      description_html: '<p>A <b>description</b> with an emoji 🦄.</p>',
      date_modified: '2016-06-22T05:32:43+00:00',
      date_published: '2016-06-22T04:30:00+00:00',
      date_updated: '2016-06-22T05:33:20+00:00',
      content_rating: 'teen',
      completion_status: 'hiatus',
      cover_image: { thumbnail: 'https://cdn-img.fimfiction.net/story/x-thumb', medium: 'https://cdn-img.fimfiction.net/story/x-medium', large: 'https://cdn-img.fimfiction.net/story/x-large', full: 'https://cdn-img.fimfiction.net/story/x-full' },
      num_words: 12,
      num_chapters: 2,
      status: 'visible',
      published: true,
      url: 'https://www.fimfiction.net/story/289663/summer-island'
    },
    relationships: {
      author: { data: { type: 'user', id: '1' } },
      chapters: { data: [{ type: 'chapter', id: '2' }, { type: 'chapter', id: '3' }, { type: 'chapter', id: '1' }] },
      tags: { data: [{ type: 'story_tag', id: '10' }, { type: 'story_tag', id: '11' }] },
      prequel: { data: { type: 'story', id: '1' } }
    }
  },
  included: [
    { type: 'user', id: '1', attributes: { name: 'djazz', url: 'https://www.fimfiction.net/user/1/djazz' } },
    { type: 'chapter', id: '1', attributes: { chapter_number: 1, title: 'Chapter One', published: true, date_modified: '2016-06-22T05:32:43+00:00', date_published: '2016-06-22T04:30:00+00:00', num_words: 6, url: 'https://www.fimfiction.net/story/289663/1/summer-island/chapter-one', content_html: chapterOne, authors_note_html: noteOne, authors_note_position: 'bottom' } },
    { type: 'chapter', id: '2', attributes: { chapter_number: 2, title: 'Chapter Two: "Quotes" & Ampersands', published: true, date_modified: '2016-06-22T05:33:20+00:00', date_published: '2016-06-22T05:33:20+00:00', num_words: 6, url: 'https://www.fimfiction.net/story/289663/2/summer-island/chapter-two', content_html: chapterTwo, authors_note_html: noteTwo, authors_note_position: 'top' } },
    { type: 'chapter', id: '3', attributes: { chapter_number: 3, title: 'Unpublished', published: false, num_words: 1, content_html: '<p>secret</p>' } },
    { type: 'story_tag', id: '10', attributes: { name: 'Adventure', type: 'genre', url: 'https://www.fimfiction.net/tag/adventure' } },
    { type: 'story_tag', id: '11', attributes: { name: 'Scootaloo', type: 'character', url: 'https://www.fimfiction.net/tag/scootaloo' } }
  ]
}
const v2Prequel = { data: { type: 'story', id: '1', attributes: { title: 'The Prequel', url: 'https://www.fimfiction.net/story/1/the-prequel' } } }

const requests = []
let hideCover = false
globalThis.fetch = async function mockFetch (url, init = {}) {
  url = String(url)
  requests.push({ url, headers: init.headers || {} })
  const u = new URL(url)
  const respond = (body, type, status = 200) => new Response(body, { status, headers: { 'content-type': type } })
  if (u.pathname === '/api/story.php') {
    const story = JSON.parse(JSON.stringify(v1Story))
    if (hideCover) { story.story.full_image = ''; story.story.image = '' }
    return respond(JSON.stringify(story), 'text/javascript')
  }
  if (u.pathname === '/story/289663/summer-island') return respond(storyPage, 'text/html')
  if (u.pathname === '/story/download/289663/html') return respond(downloadHtml, 'text/html')
  if (u.pathname === '/api/v2/stories/289663') {
    assert.strictEqual(init.headers.authorization, 'Bearer test-token', 'API token must be sent')
    assert.ok(u.searchParams.get('include').includes('chapters'))
    return respond(JSON.stringify(v2Doc), 'application/vnd.api+json')
  }
  if (u.pathname === '/api/v2/stories/1') return respond(JSON.stringify(v2Prequel), 'application/vnd.api+json')
  if (u.hostname === 'cdn-img.fimfiction.net' && u.pathname.endsWith('x-full')) return respond(coverJpeg, 'image/jpeg')
  if (u.pathname === '/user/img1.png') return respond(imagePng, 'image/png')
  if (u.pathname.endsWith('twilightsmile.png')) return respond(emoticonPng, 'image/png')
  if (u.pathname === '/broken1.png' || u.pathname === '/broken2.png') return respond(brokenPng, 'image/png')
  if (u.pathname === '/vector.svg') return respond(svgImage, 'image/svg+xml')
  if (u.pathname.endsWith('/1f984.svg')) return respond(emojiSvg, 'image/svg+xml')
  if (u.hostname === 'www.googleapis.com') return respond(JSON.stringify({ items: [{ id: 'dQw4w9WgXcQ', snippet: { title: 'Video Title', thumbnails: { high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } } } }] }), 'application/json')
  if (u.hostname === 'i.ytimg.com') return respond(coverJpeg, 'image/jpeg')
  return respond('not found', 'text/plain', 404)
}

const FimFic2Epub = require(path.join(ROOT, 'dist/fimfic2epub.js')).default

function readingSummary (ffc) {
  return {
    title: ffc.storyInfo.title,
    author: ffc.storyInfo.author.name,
    status: ffc.storyInfo.status,
    rating: ffc.storyInfo.content_rating_text,
    tags: ffc.tags.map((t) => t.type + ':' + t.name),
    subjects: ffc.subjects,
    prequel: ffc.storyInfo.prequel && ffc.storyInfo.prequel.title,
    publishDate: ffc.storyInfo.publishDate,
    chapters: ffc.storyInfo.chapters.map((c) => [c.title, c.realWordCount]),
    notesFirst: ffc.chapters.map((c) => c.notesFirst),
    hasAuthorNotes: ffc.hasAuthorNotes,
    cover: ffc.coverImageDimensions,
    coverType: ffc.coverType,
    remote: [...ffc.remoteResources.entries()].map(([url, r]) => [url.replace(/^https?:\/\//, ''), r.dest]),
    icons: [...ffc.usedIcons],
    readingEase: ffc.readingEase && Math.round(ffc.readingEase.ease),
    totalWords: ffc.totalWordCount
  }
}

async function generate (name, options, prepare) {
  const ffc = new FimFic2Epub(STORY, Object.assign({ readingEaseWakeupInterval: 800 }, options))
  const statuses = []
  ffc.on('progress', (percent, status) => { if (status) statuses.push(status) })
  if (prepare) await prepare(ffc)
  await ffc.fetchMetadata()
  ffc.storyInfo.short_description = ffc.storyInfo.short_description || 'desc'
  await ffc.fetchAll()
  await ffc.build()
  const file = await ffc.getFile()
  assert.ok(Buffer.isBuffer(file) && file.length > 1000, 'epub buffer')
  const out = path.join(OUT, name + '.epub')
  fs.writeFileSync(out, file)
  console.log('wrote', out, file.length, 'bytes')
  return { ffc, summary: readingSummary(ffc), statuses }
}

;(async () => {
  // 1. legacy path: v1 API + story page + html download
  const legacy = await generate('legacy', {})
  console.log(JSON.stringify(legacy.summary, null, 1))
  const s = legacy.summary
  assert.strictEqual(s.title, 'Summer Island')
  assert.strictEqual(s.status, 'On Hiatus')
  assert.deepStrictEqual(s.tags, ['genre:Adventure', 'character:Scootaloo'])
  assert.deepStrictEqual(s.subjects, ['Fimfiction', 'Everyone', 'Adventure', 'Scootaloo'])
  assert.strictEqual(s.prequel, 'The Prequel')
  assert.strictEqual(s.publishDate, 1466571000)
  assert.strictEqual(s.chapters.length, 2)
  assert.ok(s.chapters[0][1] > 10 && s.chapters[1][1] > 3, 'word counts computed: ' + JSON.stringify(s.chapters))
  assert.deepStrictEqual(s.notesFirst, [false, true])
  assert.strictEqual(s.hasAuthorNotes, true)
  assert.deepStrictEqual(s.cover, { width: 600, height: 800 })
  assert.strictEqual(s.coverType, 'image/jpeg')
  assert.deepStrictEqual(s.icons, ['pause'], 'On Hiatus status must map to the pause icon')
  assert.ok(legacy.ffc.iconsFont, 'subset font created')
  assert.ok(s.readingEase !== null && !isNaN(s.readingEase), 'reading ease')
  const remote = new Map(s.remote)
  assert.strictEqual(remote.get('example.com/broken1.png'), remote.get('example.com/broken2.png'), 'identical images are stored once by default')
  assert.ok(remote.get('example.com/vector.svg').endsWith('.svg'), 'svg detected: ' + remote.get('example.com/vector.svg'))
  assert.ok(/^Images\/emoticon_twilightsmile\.png$/.test(remote.get('static.fimfiction.net/images/emoticons/twilightsmile.png')), 'emoticon naming')
  assert.ok([...remote.keys()].some((k) => k.includes('cdn.jsdelivr.net/gh/jdecked/twemoji')), 'emoji fetched from jsdelivr')
  assert.ok([...remote.keys()].some((k) => k.includes('i.ytimg.com')), 'youtube thumbnail embedded')
  assert.ok(legacy.ffc.chaptersHtml[0].includes('../Images/ch_001_'), 'image urls rewritten to local files')
  assert.ok(legacy.ffc.chaptersHtml[1].includes('figure class="youtube"') && legacy.ffc.chaptersHtml[1].includes('Video Title on YouTube'), 'youtube figure rendered')
  assert.ok(legacy.ffc.pages.title.includes('The Prequel') && legacy.ffc.pages.title.includes('Adventure'), 'title page content')
  assert.ok(legacy.ffc.pages.cover.includes('viewBox="0 0 600 800"'), 'svg cover wrapper')
  assert.ok(!legacy.statuses.some((st) => /error/i.test(st)), 'no error statuses')

  // 2. option variants: no dedupe, notes index, kepubify, typogrify, indented paragraphs, no bars
  const variant = await generate('variants', { dedupeImages: false, useAuthorNotesIndex: true, kepubify: true, typogrify: true, paragraphStyle: 'both', addChapterBars: false, joinSubjects: true, wordsPerMinute: 0 })
  const vremote = new Map(variant.summary.remote)
  assert.notStrictEqual(vremote.get('example.com/broken1.png'), vremote.get('example.com/broken2.png'), 'dedupe disabled keeps separate files')
  assert.ok(variant.ffc.pages.notesnav && variant.ffc.notesHtml.filter(Boolean).length === 2, 'notes index generated')
  assert.ok(variant.ffc.chaptersHtml[0].includes('koboSpan'), 'kepubify spans')
  assert.ok(variant.ffc.chaptersHtml[0].includes('“') || variant.ffc.chaptersHtml[0].includes('&#8220;'), 'typogrify smart quotes')
  assert.ok(variant.ffc.chaptersHtml[0].includes('½') || variant.ffc.chaptersHtml[0].includes('&#189;'), 'typogrify fractions')

  // 3. API v2 path
  requests.length = 0
  const api = await generate('apiv2', { apiToken: 'test-token' })
  console.log(JSON.stringify(api.summary, null, 1))
  const a = api.summary
  assert.strictEqual(a.title, 'Summer Island')
  assert.strictEqual(a.status, 'On Hiatus')
  assert.strictEqual(a.rating, 'Teen')
  assert.deepStrictEqual(a.tags, ['genre:Adventure', 'character:Scootaloo'])
  assert.deepStrictEqual(a.subjects, ['Fimfiction', 'Teen', 'Adventure', 'Scootaloo'])
  assert.strictEqual(a.prequel, 'The Prequel')
  assert.strictEqual(a.publishDate, Math.floor(Date.parse('2016-06-22T04:30:00+00:00') / 1000))
  assert.deepStrictEqual(a.chapters.map((c) => c[0]), ['Chapter One', 'Chapter Two: "Quotes" & Ampersands'], 'chapters sorted, unpublished dropped')
  assert.deepStrictEqual(a.notesFirst, [false, true])
  assert.deepStrictEqual(a.cover, { width: 600, height: 800 })
  assert.ok(api.ffc.storyInfo.chapters[1].link.endsWith('/chapter-two'))
  assert.ok(!requests.some((r) => r.url.includes('/story/download/')), 'API path must not scrape the website')
  assert.ok(api.ffc.pages.title.includes('The Prequel'))
  assert.deepStrictEqual(a.remote.map((r) => r[1]).sort(), s.remote.map((r) => r[1]).sort(), 'same embedded files as the legacy path')

  // 4. story without a cover image: generated with @napi-rs/canvas
  hideCover = true
  const nocover = await generate('nocover', {})
  hideCover = false
  assert.deepStrictEqual(nocover.summary.cover, { width: 1080, height: 1440 })
  assert.strictEqual(nocover.summary.coverType, 'image/jpeg')

  // 5. error handling: an empty download must fail loudly instead of crashing later
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => (String(url).includes('/story/download/') ? new Response('<html>nothing here</html>', { status: 200, headers: { 'content-type': 'text/html' } }) : originalFetch(url, init))
  const broken = new FimFic2Epub(STORY, {})
  await broken.fetchMetadata()
  await assert.rejects(() => broken.fetchAll(), /No chapter contents could be extracted/)
  globalThis.fetch = originalFetch

  // 6. Cloudflare challenge detection
  globalThis.fetch = async (url) => new Response('<html><title>Just a moment...</title></html>', { status: 403, headers: { 'content-type': 'text/html; charset=UTF-8', 'cf-mitigated': 'challenge', server: 'cloudflare' } })
  const blocked = new FimFic2Epub(STORY, {})
  await assert.rejects(() => blocked.fetchMetadata(), (err) => err.name === 'CloudflareChallengeError' && /--token/.test(err.message))
  globalThis.fetch = originalFetch

  console.log('\nNode end-to-end test passed')
})().catch((err) => {
  console.error('\nNode end-to-end test FAILED')
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
