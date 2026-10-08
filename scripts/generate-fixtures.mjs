// Writes small synthetic sample images (fictional metadata, no real photos)
// to tests/fixtures for manual testing. Run with: npm run fixtures
import { mkdir, writeFile } from 'node:fs/promises'
import { buildJpeg, buildPng, buildSamplePhoto, buildWebp, sampleExif, sampleXmp } from '../tests/helpers/fixtures.ts'

const outputDir = new URL('../tests/fixtures/', import.meta.url)
await mkdir(outputDir, { recursive: true })

const fixtures = {
  'sample-photo.jpg': buildSamplePhoto(),
  'sample-rotated.jpg': buildSamplePhoto({ orientation: 6 }),
  'sample-ai-c2pa.jpg': buildJpeg({ c2pa: true, xmp: sampleXmp({ ai: true }) }),
  'sample-ai-parameters.png': buildPng({ text: { parameters: 'a lighthouse at dusk, Steps: 30' }, time: true }),
  'sample-photo.webp': buildWebp({ exif: sampleExif(), xmp: sampleXmp(), icc: true }),
  'no-metadata.jpg': buildJpeg(),
}

for (const [name, bytes] of Object.entries(fixtures)) {
  await writeFile(new URL(name, outputDir), bytes)
  console.log(`wrote tests/fixtures/${name} (${bytes.length} bytes)`)
}
