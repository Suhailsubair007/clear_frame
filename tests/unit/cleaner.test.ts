import { describe, expect, it, vi } from 'vitest'
import { analyzeImageMetadata } from '~/composables/useImageMetadata'
import { cleanImage, type CleanDependencies, type CleaningStep } from '~/utils/cleaner'
import { inspectContainer } from '~/utils/containers'
import { ClearFrameError } from '~/utils/errors'
import { BASE_HEIGHT, BASE_WIDTH, buildJpeg, buildPng, jpegScanData, sampleExif, sampleXmp } from '../helpers/fixtures'

const dimensions = { width: BASE_WIDTH, height: BASE_HEIGHT }

function createDeps(overrides: Partial<CleanDependencies> = {}) {
  const steps: CleaningStep[] = []
  const deps: CleanDependencies = {
    analyze: analyzeImageMetadata,
    reencode: vi.fn(async (blob: Blob) => blob),
    decode: vi.fn(async () => dimensions),
    onStep: (step) => {
      steps.push(step)
    },
    ...overrides,
  }
  return { deps, steps }
}

describe('cleanImage', () => {
  it('runs every step in order and returns a verified, metadata-free file', async () => {
    const bytes = buildJpeg({ exif: sampleExif(), xmp: sampleXmp(), iptc: true, comment: 'hi' })
    const before = await analyzeImageMetadata(bytes, 'jpeg')
    const { deps, steps } = createDeps()

    const result = await cleanImage({ bytes, format: 'jpeg', mode: 'original', before, dimensions }, deps)

    expect(steps).toEqual(['analyzing', 'removing', 'encoding', 'verifying', 'done'])
    expect(deps.reencode).not.toHaveBeenCalled()
    expect(deps.decode).toHaveBeenCalledOnce()
    expect(result.blob.type).toBe('image/jpeg')

    const output = new Uint8Array(await result.blob.arrayBuffer())
    expect(inspectContainer(output, 'jpeg').blocks).toEqual([])
    expect(jpegScanData(output)).toEqual(jpegScanData(bytes))
    expect(result.removedCount).toBe(before.categories.filter((category) => category.status === 'found').length)
    expect(result.remainingCount).toBe(0)
    expect(result.fieldsRemoved).toBe(before.fieldCount)
  })

  it('re-encodes in balanced mode and strips the encoder output again', async () => {
    const bytes = buildJpeg({ exif: sampleExif() })
    const before = await analyzeImageMetadata(bytes, 'jpeg')
    // Simulate an encoder that adds its own metadata.
    const encoderOutput = buildJpeg({ comment: 'Encoder signature' })
    const reencode = vi.fn(async () => new Blob([encoderOutput], { type: 'image/jpeg' }))
    const { deps } = createDeps({ reencode })

    const result = await cleanImage({ bytes, format: 'jpeg', mode: 'balanced', before, dimensions }, deps)

    expect(reencode).toHaveBeenCalledWith(expect.any(Blob), 'image/jpeg', 0.9)
    const output = new Uint8Array(await result.blob.arrayBuffer())
    expect(inspectContainer(output, 'jpeg').blocks).toEqual([])
  })

  it('fails verification when the output does not decode to the same size', async () => {
    const bytes = buildPng({ text: { Comment: 'x' } })
    const before = await analyzeImageMetadata(bytes, 'png')
    const { deps } = createDeps({ decode: async () => ({ width: 1, height: 1 }) })

    await expect(
      cleanImage({ bytes, format: 'png', mode: 'original', before, dimensions }, deps),
    ).rejects.toMatchObject({ code: 'verification-failed' })
  })

  it('fails verification when the output does not decode at all', async () => {
    const bytes = buildJpeg()
    const before = await analyzeImageMetadata(bytes, 'jpeg')
    const { deps } = createDeps({
      decode: async () => {
        throw new ClearFrameError('decode-failed')
      },
    })
    await expect(
      cleanImage({ bytes, format: 'jpeg', mode: 'original', before, dimensions }, deps),
    ).rejects.toMatchObject({ code: 'verification-failed' })
  })

  it('surfaces corrupted input as a friendly error', async () => {
    const bytes = buildJpeg().subarray(0, 30)
    const before = await analyzeImageMetadata(buildJpeg(), 'jpeg')
    const { deps } = createDeps()
    await expect(
      cleanImage({ bytes: new Uint8Array(bytes), format: 'jpeg', mode: 'original', before, dimensions }, deps),
    ).rejects.toBeInstanceOf(ClearFrameError)
  })
})
