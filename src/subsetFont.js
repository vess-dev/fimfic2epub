import isNode from 'detect-node'
import { Font } from 'fonteditor-core'

// Creates a TTF font containing only the given glyphs (unicode code points).
// fontData is the TTF file as a binary string (webpack's binary-loader),
// Buffer, ArrayBuffer or Uint8Array.
export default function subsetFont (fontData, glyphs) {
  let buffer
  if (typeof fontData === 'string') {
    buffer = Buffer.from(fontData, 'binary')
  } else if (fontData instanceof ArrayBuffer) {
    buffer = Buffer.from(fontData)
  } else {
    buffer = Buffer.from(fontData.buffer, fontData.byteOffset, fontData.byteLength)
  }
  // fonteditor-core wants a plain ArrayBuffer (a Node Buffer is fine, but the
  // browser polyfill isn't)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const font = Font.create(arrayBuffer, {
    type: 'ttf',
    subset: glyphs,
    hinting: true
  })
  return font.write({
    type: 'ttf',
    hinting: true,
    toBuffer: isNode
  })
}
