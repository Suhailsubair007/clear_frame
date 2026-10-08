// Regenerates the favicon set in public/ from the SVG sources in assets/icons/.
// Renders with Playwright's Chromium so the icons match what browsers draw.
// Run with: npm run icons
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const source = (name) => readFile(new URL(`../assets/icons/${name}`, import.meta.url), 'utf8')
const output = (name) => new URL(`../public/${name}`, import.meta.url)

const browser = await chromium.launch()
const page = await browser.newPage()

async function render(svg, size, { transparent = true } = {}) {
  await page.setViewportSize({ width: size, height: size })
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`)
  return page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } })
}

/** Builds an ICO file containing PNG images (supported by every current browser). */
function buildIco(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => png)])
}

const icon = await source('icon.svg')
const square = await source('icon-square.svg')
const maskable = await source('icon-maskable.svg')

// Browser tabs: modern browsers use the SVG, older ones the multi-size ICO.
await writeFile(output('favicon.svg'), icon)
const icoImages = []
for (const size of [16, 32, 48]) icoImages.push({ size, png: await render(icon, size) })
await writeFile(output('favicon.ico'), buildIco(icoImages))

// iOS home screen: opaque full-bleed square (iOS applies its own rounded mask).
await writeFile(output('apple-touch-icon.png'), await render(square, 180, { transparent: false }))

// Android / PWA: regular icons plus a maskable icon with the logo inside the safe zone.
await writeFile(output('icon-192.png'), await render(icon, 192))
await writeFile(output('icon-512.png'), await render(icon, 512))
await writeFile(output('icon-maskable-512.png'), await render(maskable, 512, { transparent: false }))

await browser.close()
console.log('Icons written to public/')
