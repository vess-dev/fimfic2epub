// Minimal mock of fimfiction.net for the extension integration test
const http = require('http')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const { createCanvas } = require(path.join(ROOT, 'node_modules/@napi-rs/canvas'))

function makeImage (w, h, color, mime) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  return c.toBuffer(mime)
}

const STORY = 289663

function start (port) {
  const origin = 'http://localhost:' + port
  const coverJpeg = makeImage(600, 800, '#3366cc', 'image/jpeg')
  const imagePng = makeImage(200, 100, '#cc3333', 'image/png')
  const requests = []

  const storyPage = `<!DOCTYPE html><html><head><title>Summer Island - Fimfiction</title></head><body>
<div class="body_container">
<div class="story_container" data-story="${STORY}">
  <div class="story_content_box">
    <div class="title"><a href="/story/${STORY}/summer-island">Summer Island</a></div>
    <div class="drop-down"><ul><li><a href="/story/download/${STORY}/epub" title="Download Story (.epub)">Download Story (.epub)</a></li></ul></div>
    <ul class="story-tags"><li><a href="/tag/adventure" class="tag-genre" title="Adventure stories" data-tag="adventure">Adventure</a></li><li><a href="/tag/scootaloo" class="tag-character" title="Scootaloo" data-tag="scootaloo">Scootaloo</a></li></ul>
    <span class="description-text bbcode"><p>A <b>description</b> of the story.</p></span>
    <div class="extra_story_data"><span class="approved-date">Published <span data-time="1466571000">27th Jun 2016</span></span><div class="button-group"></div></div>
  </div>
</div>
</div></body></html>`

  const apiStory = {
    story: {
      id: STORY,
      title: 'Summer Island',
      url: origin + '/story/' + STORY + '/summer-island',
      short_description: 'Short description.',
      description: 'desc',
      date_modified: 1466571163,
      image: origin + '/cover.jpg',
      full_image: origin + '/cover.jpg',
      views: 1,
      total_views: 1,
      words: 20,
      chapter_count: 2,
      comments: 0,
      author: { id: 1, name: 'djazz', url: origin + '/user/1/djazz' },
      likes: 1,
      dislikes: 0,
      status: 'Complete',
      content_rating: 0,
      content_rating_text: 'Everyone',
      chapters: [
        { id: 1, title: 'Chapter One', words: 10, views: 1, link: origin + '/story/' + STORY + '/1/summer-island/chapter-one', date_modified: 1466571163 },
        { id: 2, title: 'Chapter Two', words: 10, views: 1, link: origin + '/story/' + STORY + '/2/summer-island/chapter-two', date_modified: 1466571200 }
      ]
    }
  }

  const downloadHtml = `<!DOCTYPE html><html><head><title>Summer Island</title></head><body>
<article class="chapter"><header><h1>Chapter One</h1></header>
<p>Sweetie Belle doesn't believe in seaponies. <img src="${origin}/img1.png" /> So Scootaloo takes her on an airship trip.</p>
<p>Second paragraph with <b>bold</b> and <i>italic</i> text.</p>
<aside class="authors-note"><header><h1>Author's Note</h1></header><p>Thanks for reading!</p></aside>
<footer><p>footer</p></footer></article>
<article class="chapter"><header><h1>Chapter Two</h1></header>
<p>They arrive at Summer Island and everything is fine.</p>
<footer></footer></article>
</body></html>`

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, origin)
    requests.push({ path: url.pathname + url.search, origin: req.headers.origin || null, ua: (req.headers['user-agent'] || '').slice(0, 40) })
    const send = (status, type, body) => {
      res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': req.headers.origin || '*', 'access-control-allow-credentials': 'true' })
      res.end(body)
    }
    if (url.pathname === '/story/' + STORY + '/summer-island') return send(200, 'text/html; charset=utf-8', storyPage)
    if (url.pathname === '/api/story.php') return send(200, 'text/javascript; charset=utf-8', JSON.stringify(apiStory))
    if (url.pathname === '/story/download/' + STORY + '/html') return send(200, 'text/html; charset=utf-8', downloadHtml)
    if (url.pathname === '/cover.jpg') return send(200, 'image/jpeg', coverJpeg)
    if (url.pathname === '/img1.png') return send(200, 'image/png', imagePng)
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end() }
    send(404, 'text/plain', 'not found')
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, requests, origin })))
}

module.exports = { start }
