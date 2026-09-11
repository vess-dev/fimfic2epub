// Integration test of the Manifest V3 extension in a real Chromium (Chrome for
// Testing) against a local mock of fimfiction.net. Requires a build and
// puppeteer: `npm run build && npm install --no-save puppeteer && node test/browser/run.js`
const path = require('path')
const fs = require('fs')
const os = require('os')
const assert = require('assert')
const puppeteer = require('puppeteer')
const { start } = require('./server')

const ROOT = path.join(__dirname, '..', '..')
const PORT = 8765
const WORK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fimfic2epub-browser-'))
const EXT = path.join(WORK_DIR, 'extension')
const DOWNLOAD_DIR = path.join(WORK_DIR, 'downloads')

// Copy of the built extension whose manifest also matches the local mock server
function prepareExtension () {
  fs.cpSync(path.join(ROOT, 'extension'), EXT, { recursive: true })
  const manifestPath = path.join(EXT, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const local = 'http://localhost:' + PORT + '/*'
  manifest.content_scripts[0].matches.push(local)
  manifest.host_permissions.push(local)
  manifest.web_accessible_resources[0].matches.push(local)
  manifest.version = '1.0'
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1))
}

function sleep (ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function waitForDownload (dir, timeout) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.epub'))
    if (files.length > 0) {
      const file = path.join(dir, files[0])
      const size = fs.statSync(file).size
      await sleep(500)
      if (fs.statSync(file).size === size && size > 0) return file
    }
    await sleep(250)
  }
  throw new Error('no download appeared in ' + dir)
}

;(async () => {
  prepareExtension()
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
  const { server, requests, origin } = await start(PORT)
  const logs = { page: [], worker: [], errors: [] }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-extensions-except=' + EXT, '--load-extension=' + EXT, '--no-sandbox', '--disable-gpu']
  })
  try {
    console.log('browser:', await browser.version())
    // 1. the manifest is accepted and the background service worker starts
    const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().includes('background.js'), { timeout: 20000 })
    console.log('service worker:', swTarget.url())
    const worker = await swTarget.worker()
    worker.on('console', (msg) => logs.worker.push(msg.text()))
    const extensionId = new URL(swTarget.url()).host

    const page = await browser.newPage()
    page.on('console', (msg) => logs.page.push(msg.type() + ': ' + msg.text()))
    page.on('pageerror', (err) => logs.errors.push(String(err)))
    const cdp = await page.createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOAD_DIR })

    // 2. the content script runs on a story page and adds the logo button
    await page.goto(origin + '/story/289663/summer-island', { waitUntil: 'load' })
    await page.waitForSelector('.fimfic2epub-logo', { timeout: 10000 })
    const logoSrc = await page.$eval('.fimfic2epub-logo', (el) => el.src)
    assert.ok(logoSrc.startsWith('chrome-extension://' + extensionId + '/fimfic2epub-logo.png'), 'logo served as web accessible resource: ' + logoSrc)
    const logoLoaded = await page.$eval('.fimfic2epub-logo', (el) => el.complete && el.naturalWidth > 0)
    assert.ok(logoLoaded, 'logo image loads')

    // 3. the toolbar button was enabled for this tab by the content script's message
    const actionState = await worker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url: url + '/*' })
      return { tabs: tabs.length, enabled: await chrome.action.isEnabled(tabs[0].id), tabId: tabs[0].id }
    }, origin)
    console.log('action state:', JSON.stringify(actionState))
    assert.strictEqual(actionState.enabled, true, 'toolbar action enabled on the story tab')

    // 4. clicking the logo opens the dialog, metadata and chapters load
    await page.click('.fimfic2epub-logo')
    await page.waitForSelector('#epubDialogContainer table.properties', { timeout: 20000 })
    const title = await page.$eval('#epubDialogContainer table.properties input[type=text]', (el) => el.value)
    assert.strictEqual(title, 'Summer Island')
    await page.waitForFunction(() => {
      const b = document.querySelector('#epubDialogContainer button.styled_button')
      return b && !b.disabled
    }, { timeout: 20000 })
    const subjects = await page.evaluate(() => document.querySelectorAll('#epubDialogContainer textarea')[1].value)
    console.log('subjects:', JSON.stringify(subjects))
    assert.ok(subjects.includes('Adventure') && subjects.includes('Scootaloo'), 'tags parsed from the story page')

    // 5. the toolbar button message path (background -> content script) reopens the dialog
    // the close button has no size without Fimfiction's stylesheet, so click it through the DOM
    await page.$eval('#epubDialogContainer a.close_button', (el) => el.click())
    await page.waitForFunction(() => !document.querySelector('#epubDialogContainer table.properties'), { timeout: 5000 })
    await worker.evaluate((tabId) => chrome.tabs.sendMessage(tabId, { type: 'pageAction' }), actionState.tabId)
    await page.waitForSelector('#epubDialogContainer table.properties', { timeout: 10000 })

    // 6. generate the EPUB: remote images are fetched by the service worker, the file is downloaded
    await page.click('#epubDialogContainer button.styled_button')
    await page.waitForFunction(() => {
      const c = document.querySelector('#epubDialogContainer .rating_container')
      return c && /Complete!|Error/.test(c.textContent)
    }, { timeout: 60000 })
    const status = await page.$eval('#epubDialogContainer .rating_container', (el) => el.textContent.trim())
    console.log('final status:', status)
    assert.ok(status.includes('Complete!'), 'epub generation completed: ' + status)
    const file = await waitForDownload(DOWNLOAD_DIR, 20000)
    console.log('downloaded:', path.basename(file), fs.statSync(file).size, 'bytes')
    assert.strictEqual(path.basename(file), 'djazz - Summer Island.epub')

    const imageRequests = requests.filter((r) => r.path === '/cover.jpg' || r.path === '/img1.png')
    console.log('image requests:', JSON.stringify(imageRequests.map((r) => r.path)))
    assert.ok(imageRequests.length >= 2, 'cover and chapter image fetched')
    // Chrome sends no Origin header for host-permitted GETs, so the worker log is the evidence
    assert.ok(logs.worker.some((l) => l.includes('fetching ' + origin + '/cover.jpg')), 'worker fetched the cover: ' + logs.worker.join(' | '))
    assert.ok(logs.worker.some((l) => l.includes('fetching ' + origin + '/img1.png')), 'worker logged the fetch: ' + logs.worker.join(' | '))
    assert.deepStrictEqual(logs.errors, [], 'no page errors')
    const pageErrors = logs.page.filter((l) => l.startsWith('error'))
    assert.deepStrictEqual(pageErrors, [], 'no console errors: ' + pageErrors.join(' | '))
    console.log('\nChrome extension integration test passed')
    console.log('worker logs:', logs.worker.length, '| page logs:', logs.page.length)
    process.exitCode = 0
  } catch (err) {
    console.error('\nChrome extension integration test FAILED')
    console.error(err && err.stack ? err.stack : err)
    console.error('worker logs:', logs.worker.slice(-10))
    console.error('page logs:', logs.page.slice(-15))
    console.error('page errors:', logs.errors)
    process.exitCode = 1
  } finally {
    await browser.close()
    server.close()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
  }
})()
