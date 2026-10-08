import type { ImageDimensions, ImageFormat, QualityMode } from '~/types/image'
import type { CategoryOutcome, MetadataAnalysis } from '~/types/metadata'
import { inspectContainer, stripMetadata } from './containers'
import { ClearFrameError } from './errors'
import { FORMAT_MIME_TYPES, REENCODE_QUALITY } from './image'
import { compareMetadata } from './metadata'

export type CleaningStep = 'analyzing' | 'removing' | 'encoding' | 'verifying' | 'done'

export const CLEANING_STEPS: ReadonlyArray<{ id: CleaningStep; label: string }> = [
  { id: 'analyzing', label: 'Analyzing image…' },
  { id: 'removing', label: 'Removing metadata…' },
  { id: 'encoding', label: 'Creating clean image…' },
  { id: 'verifying', label: 'Verifying result…' },
  { id: 'done', label: 'Done' },
]

export interface CleanInput {
  bytes: Uint8Array<ArrayBuffer>
  format: ImageFormat
  mode: QualityMode
  /** Analysis of the original file. */
  before: MetadataAnalysis
  /** Displayed size of the original (orientation applied). */
  dimensions: ImageDimensions
}

/** Browser-specific operations, injected so the pipeline can be tested anywhere. */
export interface CleanDependencies {
  analyze(bytes: Uint8Array<ArrayBuffer>, format: ImageFormat): Promise<MetadataAnalysis>
  reencode(blob: Blob, mimeType: string, quality: number): Promise<Blob>
  /** Decodes the output and returns its displayed size. */
  decode(blob: Blob): Promise<ImageDimensions>
  onStep?(step: CleaningStep): void | Promise<void>
}

export interface CleanResult {
  blob: Blob
  mode: QualityMode
  after: MetadataAnalysis
  outcomes: CategoryOutcome[]
  removedCount: number
  remainingCount: number
  fieldsRemoved: number
}

/**
 * Removes metadata, optionally re-encodes, then verifies the output by decoding it
 * and re-reading its metadata. Nothing here touches the network.
 */
export async function cleanImage(input: CleanInput, deps: CleanDependencies): Promise<CleanResult> {
  const mimeType = FORMAT_MIME_TYPES[input.format]

  await deps.onStep?.('analyzing')
  inspectContainer(input.bytes, input.format)

  await deps.onStep?.('removing')
  let output = stripMetadata(input.bytes, input.format).bytes

  await deps.onStep?.('encoding')
  if (input.mode !== 'original') {
    const source = new Blob([output], { type: mimeType })
    const reencoded = await deps.reencode(source, mimeType, REENCODE_QUALITY[input.mode])
    // Encoders can add their own headers; strip again so nothing slips through.
    output = stripMetadata(new Uint8Array(await reencoded.arrayBuffer()), input.format).bytes
  }
  const blob = new Blob([output], { type: mimeType })

  await deps.onStep?.('verifying')
  const after = await deps.analyze(output, input.format)
  const decoded = await deps.decode(blob).catch(() => {
    throw new ClearFrameError('verification-failed', 'Cleaned image did not decode')
  })
  if (decoded.width !== input.dimensions.width || decoded.height !== input.dimensions.height) {
    throw new ClearFrameError('verification-failed', 'Cleaned image dimensions changed')
  }

  const outcomes = compareMetadata(input.before, after)
  await deps.onStep?.('done')

  return {
    blob,
    mode: input.mode,
    after,
    outcomes,
    removedCount: outcomes.filter((outcome) => outcome.outcome === 'removed').length,
    remainingCount: outcomes.filter((outcome) => outcome.outcome !== 'removed').length,
    fieldsRemoved: Math.max(0, input.before.fieldCount - after.fieldCount),
  }
}
