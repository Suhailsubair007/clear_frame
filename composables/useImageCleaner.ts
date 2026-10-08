import { computed, getCurrentInstance, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ImageDimensions, ImageFormat, QualityMode, SelectedImage } from '~/types/image'
import type { MetadataAnalysis } from '~/types/metadata'
import { CLEANING_STEPS, cleanImage, type CleanResult, type CleaningStep } from '~/utils/cleaner'
import { toUserFacingError, ClearFrameError, type UserFacingError } from '~/utils/errors'
import {
  canEncode,
  decodeImage,
  FORMAT_MIME_TYPES,
  getReencodePixelLimit,
  reencodeImage,
  sniffImageFormat,
  SNIFF_LENGTH,
} from '~/utils/image'
import { validateDimensions, validateFileBasics, validateSniffedFormat } from '~/utils/validation'
import { useFileDownload } from './useFileDownload'
import { useImageMetadata } from './useImageMetadata'

export type CleanerPhase = 'idle' | 'loading' | 'ready' | 'cleaning' | 'done' | 'error'

export interface CleanedImage extends CleanResult {
  fileName: string
  objectUrl: string
}

/**
 * Each step is shown briefly so people can follow along; the work itself
 * usually finishes in milliseconds. No percentages are invented.
 */
const STEP_DISPLAY_MS = 220

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function readBytes(file: File): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return new Uint8Array(await file.arrayBuffer())
  } catch (error) {
    throw error instanceof RangeError ? error : new ClearFrameError('read-failed')
  }
}

async function decodeBlob(blob: Blob): Promise<ImageDimensions> {
  const url = URL.createObjectURL(blob)
  try {
    return await decodeImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function getAvailableModes(format: ImageFormat, { width, height }: ImageDimensions): Promise<QualityMode[]> {
  // PNG is lossless; re-encoding would only make files bigger.
  if (format === 'png' || width * height > getReencodePixelLimit()) return ['original']
  return (await canEncode(FORMAT_MIME_TYPES[format])) ? ['original', 'balanced', 'smaller'] : ['original']
}

export function useImageCleaner() {
  const phase = ref<CleanerPhase>('idle')
  const image = shallowRef<SelectedImage | null>(null)
  const analysis = shallowRef<MetadataAnalysis | null>(null)
  const result = shallowRef<CleanedImage | null>(null)
  const error = shallowRef<UserFacingError | null>(null)
  const currentStep = ref<CleaningStep | null>(null)
  const mode = ref<QualityMode>('original')
  const availableModes = ref<QualityMode[]>(['original'])

  const { analyze } = useImageMetadata()
  const { reserveFileName } = useFileDownload()

  let originalBytes: Uint8Array<ArrayBuffer> | null = null
  /** Incremented on every reset so late async results from an old image are ignored. */
  let session = 0

  function releaseResources() {
    if (image.value) URL.revokeObjectURL(image.value.objectUrl)
    if (result.value) URL.revokeObjectURL(result.value.objectUrl)
    originalBytes = null
  }

  function reset() {
    session++
    releaseResources()
    image.value = null
    analysis.value = null
    result.value = null
    error.value = null
    currentStep.value = null
    mode.value = 'original'
    availableModes.value = ['original']
    phase.value = 'idle'
  }

  function fail(caught: unknown, fallback: Parameters<typeof toUserFacingError>[1]) {
    releaseResources()
    image.value = null
    result.value = null
    error.value = toUserFacingError(caught, fallback)
    phase.value = 'error'
  }

  async function selectFile(file: File) {
    reset()
    const current = session
    phase.value = 'loading'
    let objectUrl: string | undefined

    try {
      validateFileBasics(file)
      const bytes = await readBytes(file)
      const format = validateSniffedFormat(sniffImageFormat(bytes.subarray(0, SNIFF_LENGTH)))
      const fileAnalysis = await analyze(bytes, format)
      validateDimensions(fileAnalysis.inventory)

      objectUrl = URL.createObjectURL(file)
      const dimensions = await decodeImage(objectUrl)
      validateDimensions(dimensions)
      const modes = await getAvailableModes(format, dimensions)

      if (current !== session) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      originalBytes = bytes
      image.value = {
        file,
        name: file.name,
        size: file.size,
        format,
        mimeType: FORMAT_MIME_TYPES[format],
        ...dimensions,
        objectUrl,
      }
      analysis.value = fileAnalysis
      availableModes.value = modes
      phase.value = 'ready'
    } catch (caught) {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (current === session) fail(caught, 'corrupted')
    }
  }

  async function clean() {
    const selected = image.value
    const before = analysis.value
    const bytes = originalBytes
    if (phase.value !== 'ready' || !selected || !before || !bytes) return

    const current = session
    phase.value = 'cleaning'
    try {
      const cleaned = await cleanImage(
        { bytes, format: selected.format, mode: mode.value, before, dimensions: selected },
        {
          analyze,
          reencode: reencodeImage,
          decode: decodeBlob,
          onStep: async (step) => {
            if (current !== session) throw new Error('cancelled')
            currentStep.value = step
            await wait(STEP_DISPLAY_MS)
          },
        },
      )
      if (current !== session) return
      result.value = {
        ...cleaned,
        fileName: reserveFileName(selected.name, selected.format),
        objectUrl: URL.createObjectURL(cleaned.blob),
      }
      phase.value = 'done'
    } catch (caught) {
      if (current === session) fail(caught, 'clean-failed')
    }
  }

  const statusMessage = computed(() => {
    switch (phase.value) {
      case 'loading':
        return 'Reading your image…'
      case 'ready': {
        const found = analysis.value?.categories.filter((category) => category.status === 'found').length ?? 0
        return found ? `${found} kinds of metadata found.` : 'No metadata found.'
      }
      case 'cleaning':
        return CLEANING_STEPS.find((step) => step.id === currentStep.value)?.label ?? 'Cleaning…'
      case 'done':
        return 'Your image is clean and ready to share.'
      case 'error':
        return error.value?.title ?? ''
      default:
        return ''
    }
  })

  if (getCurrentInstance()) onBeforeUnmount(reset)

  return {
    phase,
    image,
    analysis,
    result,
    error,
    currentStep,
    mode,
    availableModes,
    statusMessage,
    selectFile,
    clean,
    reset,
  }
}
