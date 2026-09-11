const assert = require('assert')
const imageSize = require('../src/imageSize').default

function bytes (...parts) {
  return Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))))
}

function u16be (n) { return [n >> 8, n & 0xff] }
function u16le (n) { return [n & 0xff, n >> 8] }
function u32be (n) { return [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] }
function u32le (n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff] }

module.exports = {
  png () {
    const data = bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], u32be(13), 'IHDR', u32be(1080), u32be(1440), [8, 6, 0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'png', width: 1080, height: 1440 })
  },
  jpeg () {
    // SOI, APP0 segment, SOF0 with height 300 and width 200
    const data = bytes([0xff, 0xd8], [0xff, 0xe0], u16be(16), 'JFIF\0', [1, 1, 0], u16be(1), u16be(1), [0, 0],
      [0xff, 0xc0], u16be(17), [8], u16be(300), u16be(200), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])
    assert.deepStrictEqual(imageSize(data), { type: 'jpg', width: 200, height: 300 })
  },
  jpegWithoutSofTerminates () {
    // a zero-length segment must not hang the parser
    const data = bytes([0xff, 0xd8], [0xff, 0xe0], u16be(0), [0, 0, 0, 0])
    assert.strictEqual(imageSize(data), null)
  },
  gif () {
    const data = bytes('GIF89a', u16le(640), u16le(480), [0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'gif', width: 640, height: 480 })
  },
  webpLossy () {
    const data = bytes('RIFF', u32le(100), 'WEBP', 'VP8 ', u32le(80), [0x10, 0x02, 0x00], [0x9d, 0x01, 0x2a], u16le(550), u16le(368), [0, 0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'webp', width: 550, height: 368 })
  },
  webpLossless () {
    // 14 bit width-1 = 99, 14 bit height-1 = 199
    const bits = 99 | (199 << 14)
    const data = bytes('RIFF', u32le(100), 'WEBP', 'VP8L', u32le(80), [0x2f], u32le(bits), [0, 0, 0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'webp', width: 100, height: 200 })
  },
  webpExtended () {
    const data = bytes('RIFF', u32le(100), 'WEBP', 'VP8X', u32le(10), [0x10, 0, 0, 0], [0xff, 0x03, 0x00], [0x2f, 0x02, 0x00], [0, 0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'webp', width: 1024, height: 560 })
  },
  bmp () {
    const data = bytes('BM', u32le(1000), u32le(0), u32le(54), u32le(40), u32le(320), u32le(-240 >>> 0), [0, 0, 0, 0])
    assert.deepStrictEqual(imageSize(data), { type: 'bmp', width: 320, height: 240 })
  },
  svgAttributes () {
    const data = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80"><rect/></svg>')
    assert.deepStrictEqual(imageSize(data), { type: 'svg', width: 120, height: 80 })
  },
  svgViewBox () {
    const data = Buffer.from('<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"></svg>')
    assert.deepStrictEqual(imageSize(data), { type: 'svg', width: 400, height: 300 })
  },
  unknown () {
    assert.strictEqual(imageSize(Buffer.from('not an image at all')), null)
    assert.strictEqual(imageSize(Buffer.alloc(0)), null)
  },
  acceptsArrayBuffer () {
    const data = bytes('GIF87a', u16le(2), u16le(3), [0, 0, 0])
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    assert.deepStrictEqual(imageSize(ab), { type: 'gif', width: 2, height: 3 })
  }
}
