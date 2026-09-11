const assert = require('assert')
const { cleanMarkup } = require('../src/cleanMarkup')
const { htmlWordCount, htmlToText } = require('../src/utils')

module.exports = {
  async emojiUseJsDelivr () {
    const html = await cleanMarkup('<p>Hello 🦄 world</p>')
    assert.ok(html.includes('https://cdn.jsdelivr.net/gh/jdecked/twemoji@'), 'twemoji base should point at jsDelivr: ' + html)
    assert.ok(html.includes('/svg/1f984.svg'), 'unicorn emoji should be converted to an svg image: ' + html)
    assert.ok(!html.includes('maxcdn'), 'the dead MaxCDN host must not be used')
  },
  async fixesTagsAndLinks () {
    const html = await cleanMarkup('<p><u>under</u> and <s>strike</s> <a href="/user/1/djazz" rel="nofollow">djazz</a></p><p><img src="https://example.com/a.png" /></p>')
    assert.ok(html.includes('<span style="text-decoration: underline">under</span>'))
    assert.ok(html.includes('<span style="text-decoration: line-through">strike</span>'))
    assert.ok(html.includes('href="https://www.fimfiction.net/user/1/djazz"'))
    assert.ok(html.includes('<img src="https://example.com/a.png" alt="Image"'), html)
  },
  async emptyInput () {
    assert.strictEqual(await cleanMarkup(''), '')
    assert.strictEqual(await cleanMarkup(null), '')
  },
  wordCount () {
    assert.strictEqual(htmlWordCount('<p>One two three.</p><p>Four <i>five</i> https://example.com/six</p>'), 5)
    assert.strictEqual(htmlWordCount('<pre>ignored code</pre><p>seven</p>'), 1)
  },
  textConversion () {
    assert.strictEqual(htmlToText('<p>Hello <a href="https://x.y">there</a> <img src="a.png"/></p>').trim(), 'Hello there')
  }
}
