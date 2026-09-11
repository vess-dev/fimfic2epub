// Minimal image dimension parser, replacing the archived `image-size` package
// (CVE-2025-71329 / CVE-2025-71330). Supports PNG, JPEG, GIF, WebP (VP8, VP8L,
// VP8X), BMP and SVG. Every loop is bounded and always advances, so malformed
// input can never hang the process. Returns { width, height, type } or null.

function toBytes (input) {
  if (input instanceof Uint8Array) return input // Buffer is a Uint8Array subclass
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  throw new TypeError('imageSize expects a Buffer, Uint8Array or ArrayBuffer')
}

const readU16BE = (b, o) => (b[o] << 8) | b[o + 1]
const readU16LE = (b, o) => b[o] | (b[o + 1] << 8)
const readU24LE = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)
const readU32BE = (b, o) => b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3])
const readU32LE = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000
const ascii = (b, o, len) => String.fromCharCode.apply(null, b.subarray(o, o + len))

function png (b) {
  if (b.length < 24) return null
  if (b[0] !== 0x89 || ascii(b, 1, 3) !== 'PNG' || b[4] !== 0x0d || b[5] !== 0x0a || b[6] !== 0x1a || b[7] !== 0x0a) return null
  let o = 8
  // Apple-optimized PNGs put a CgBI chunk in front of IHDR
  if (ascii(b, 12, 4) === 'CgBI') o = 8 + 4 + 4 + readU32BE(b, 8) + 4
  if (b.length < o + 16 || ascii(b, o + 4, 4) !== 'IHDR') return null
  return { type: 'png', width: readU32BE(b, o + 8), height: readU32BE(b, o + 12) }
}

function jpeg (b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let o = 2
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null // corrupt stream
    const marker = b[o + 1]
    if (marker === 0xff) { o++; continue } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue } // markers without payload
    if (marker === 0xd9 || marker === 0xda) return null // end of image / start of scan before any SOF
    const length = readU16BE(b, o + 2)
    if (length < 2) return null
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSOF) {
      if (o + 9 > b.length) return null
      return { type: 'jpg', height: readU16BE(b, o + 5), width: readU16BE(b, o + 7) }
    }
    o += 2 + length
  }
  return null
}

function gif (b) {
  if (b.length < 10) return null
  const signature = ascii(b, 0, 6)
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null
  return { type: 'gif', width: readU16LE(b, 6), height: readU16LE(b, 8) }
}

function webp (b) {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ') {
    // lossy bitstream: 3 byte frame tag, 3 byte start code, then 14 bit width and height
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null
    return { type: 'webp', width: readU16LE(b, 26) & 0x3fff, height: readU16LE(b, 28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    // lossless bitstream: signature byte, then 14 bit width-1 and height-1
    if (b[20] !== 0x2f) return null
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
    return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    // extended format: 24 bit canvas width-1 and height-1
    return { type: 'webp', width: readU24LE(b, 24) + 1, height: readU24LE(b, 27) + 1 }
  }
  return null
}

function bmp (b) {
  if (b.length < 26 || ascii(b, 0, 2) !== 'BM') return null
  const headerSize = readU32LE(b, 14)
  if (headerSize === 12) { // BITMAPCOREHEADER
    return { type: 'bmp', width: readU16LE(b, 18), height: readU16LE(b, 20) }
  }
  return { type: 'bmp', width: readU32LE(b, 18), height: Math.abs(readU32LE(b, 22) | 0) }
}

function svg (b) {
  // the root element is always near the start of the document
  const head = new TextDecoder('utf-8').decode(b.subarray(0, Math.min(b.length, 16384)))
  const root = head.match(/<svg\b[^>]*>/i)
  if (!root) return null
  const attrs = root[0]
  const numeric = (name) => {
    const m = attrs.match(new RegExp('\\s' + name + '\\s*=\\s*["\']\\s*([0-9]*\\.?[0-9]+)\\s*(?:px)?\\s*["\']', 'i'))
    return m ? parseFloat(m[1]) : 0
  }
  let width = numeric('width')
  let height = numeric('height')
  if (!width || !height) {
    const viewBox = attrs.match(/\sviewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i)
    if (viewBox) {
      const vw = parseFloat(viewBox[1])
      const vh = parseFloat(viewBox[2])
      if (vw > 0 && vh > 0) {
        if (width && !height) height = width * vh / vw
        else if (height && !width) width = height * vw / vh
        else { width = vw; height = vh }
      }
    }
  }
  if (!width || !height) return null
  return { type: 'svg', width: Math.round(width), height: Math.round(height) }
}

export default function imageSize (input) {
  const bytes = toBytes(input)
  return png(bytes) || jpeg(bytes) || gif(bytes) || webp(bytes) || bmp(bytes) || svg(bytes) || null
}
