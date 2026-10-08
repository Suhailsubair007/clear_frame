import { describe, expect, it } from 'vitest'
import { analyzeImageMetadata } from '~/composables/useImageMetadata'
import type { MetadataAnalysis, MetadataCategoryId } from '~/types/metadata'
import { stripMetadata } from '~/utils/containers'
import { cleanText, compareMetadata } from '~/utils/metadata'
import { buildJpeg, buildPng, buildWebp, sampleExif, sampleXmp } from '../helpers/fixtures'

function status(analysis: MetadataAnalysis, id: MetadataCategoryId) {
  return analysis.categories.find((category) => category.id === id)
}

describe('analyzeImageMetadata', () => {
  it('detects location, camera, dates, software, author, XMP and IPTC in a JPEG', async () => {
    const analysis = await analyzeImageMetadata(
      buildJpeg({ exif: sampleExif(), xmp: sampleXmp(), iptc: true, comment: 'note' }),
      'jpeg',
    )
    expect(analysis.parseFailed).toBe(false)
    expect(status(analysis, 'exif')?.status).toBe('found')
    expect(status(analysis, 'gps')?.hint).toBe('37.7749° N, 122.4194° W')
    expect(status(analysis, 'camera')?.hint).toBe('ExampleCam X100')
    expect(status(analysis, 'datetime')?.status).toBe('found')
    expect(status(analysis, 'software')?.hint).toBe('PhotoTool 2.1')
    expect(status(analysis, 'author')?.status).toBe('found')
    expect(status(analysis, 'description')?.status).toBe('found')
    expect(status(analysis, 'xmp')?.status).toBe('found')
    expect(status(analysis, 'iptc')?.status).toBe('found')
    expect(status(analysis, 'ai')?.status).toBe('not-found')
    expect(analysis.fieldCount).toBeGreaterThan(10)
    expect(analysis.groups.map((group) => group.id)).toContain('location')
  })

  it('reports clean images as having nothing to remove', async () => {
    const analysis = await analyzeImageMetadata(buildJpeg(), 'jpeg')
    const found = analysis.categories.filter((category) => category.status === 'found')
    expect(found).toEqual([])
    expect(analysis.categories.map((category) => category.id)).toEqual([
      'exif',
      'gps',
      'camera',
      'datetime',
      'software',
      'xmp',
      'iptc',
      'ai',
    ])
  })

  it('detects C2PA manifests and IPTC digital source types', async () => {
    const analysis = await analyzeImageMetadata(buildJpeg({ c2pa: true, xmp: sampleXmp({ ai: true }) }), 'jpeg')
    expect(analysis.provenance.c2pa).toBe(true)
    expect(analysis.provenance.digitalSourceType).toBe('trainedAlgorithmicMedia')
    expect(analysis.provenance.softwareHints.map((hint) => hint.toLowerCase())).toContain('adobe firefly')
    expect(status(analysis, 'ai')?.status).toBe('found')
    expect(status(analysis, 'ai')?.hint).toContain('Content Credentials')
  })

  it('detects AI generation parameters in PNG text chunks', async () => {
    const analysis = await analyzeImageMetadata(
      buildPng({ text: { parameters: 'a lighthouse at dusk, Steps: 30' }, time: true }),
      'png',
    )
    expect(analysis.provenance.generationParameters).toEqual(['parameters'])
    expect(status(analysis, 'ai')?.status).toBe('found')
    expect(status(analysis, 'datetime')?.status).toBe('found')
  })

  it('reads WebP EXIF and XMP', async () => {
    const analysis = await analyzeImageMetadata(buildWebp({ exif: sampleExif(), xmp: sampleXmp() }), 'webp')
    expect(status(analysis, 'gps')?.status).toBe('found')
    expect(status(analysis, 'xmp')?.status).toBe('found')
  })
})

describe('compareMetadata', () => {
  it('marks everything removed after a lossless clean, except the kept colour profile', async () => {
    const original = buildJpeg({ exif: sampleExif(), xmp: sampleXmp(), iptc: true, icc: true, c2pa: true })
    const before = await analyzeImageMetadata(original, 'jpeg')
    const after = await analyzeImageMetadata(stripMetadata(original, 'jpeg').bytes, 'jpeg')
    const outcomes = compareMetadata(before, after)

    expect(outcomes.find((outcome) => outcome.id === 'icc')?.outcome).toBe('kept')
    expect(outcomes.filter((outcome) => outcome.id !== 'icc').every((outcome) => outcome.outcome === 'removed')).toBe(
      true,
    )
    expect(after.fieldCount).toBe(0)
  })

  it('reports EXIF as removed when only the orientation tag remains', async () => {
    const original = buildJpeg({ exif: sampleExif({ orientation: 6 }) })
    const before = await analyzeImageMetadata(original, 'jpeg')
    const after = await analyzeImageMetadata(stripMetadata(original, 'jpeg').bytes, 'jpeg')
    const outcomes = compareMetadata(before, after)

    expect(outcomes.find((outcome) => outcome.id === 'exif')).toMatchObject({
      outcome: 'removed',
      note: 'Only the orientation tag remains.',
    })
    expect(outcomes.find((outcome) => outcome.id === 'orientation')?.outcome).toBe('kept')
    expect(outcomes.find((outcome) => outcome.id === 'gps')?.outcome).toBe('removed')
  })

  it('never claims removal when metadata is still present', async () => {
    const original = buildJpeg({ exif: sampleExif() })
    const analysis = await analyzeImageMetadata(original, 'jpeg')
    const outcomes = compareMetadata(analysis, analysis)
    expect(outcomes.find((outcome) => outcome.id === 'gps')).toMatchObject({
      outcome: 'not-removed',
      note: 'This metadata type cannot currently be removed by ClearFrame.',
    })
  })
})

describe('cleanText', () => {
  it('strips control characters and truncates long values', () => {
    expect(cleanText('a\u0000b\nc')).toBe('a b c')
    expect(cleanText('x'.repeat(500))).toHaveLength(160)
  })
})
