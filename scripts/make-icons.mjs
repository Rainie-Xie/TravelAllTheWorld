// Generates PWA PNG icons (lime background, butter-yellow sun, white map pin) with no deps.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

function colorAt(x, y) {
  // x,y in [0,1]
  const bg = mix(hex('#C4EE97'), hex('#7CC85A'), (x + y) / 2)
  let c = bg
  // sun
  const sx = x - 0.72, sy = y - 0.28
  if (sx * sx + sy * sy < 0.14 * 0.14) c = hex('#FFE066')
  // pin: circle + tail
  const px = x - 0.46, py = y - 0.47
  const inCircle = px * px + py * py < 0.2 * 0.2
  const t = (y - 0.47) / (0.83 - 0.47)
  const inTail = y > 0.47 && y < 0.83 && Math.abs(px) < 0.2 * (1 - t) * 0.92
  if (inCircle || inTail) c = hex('#FFFFFF')
  if (px * px + py * py < 0.085 * 0.085) c = hex('#6DBE45')
  return c
}

function png(size) {
  const ss = 4
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0]
      for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
        const c = colorAt((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size)
        acc = acc.map((v, k) => v + c[k])
      }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = acc[0] / (ss * ss); raw[o + 1] = acc[1] / (ss * ss); raw[o + 2] = acc[2] / (ss * ss); raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/apple-touch-icon.png', png(180))
console.log('icons written')
