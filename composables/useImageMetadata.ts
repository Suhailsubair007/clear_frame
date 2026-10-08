import type { ExpandedTags } from 'exifreader'
import type { ImageFormat } from '~/types/image'
import type { MetadataAnalysis } from '~/types/metadata'
import { inspectContainer } from '~/utils/containers'
import { summarizeMetadata } from '~/utils/metadata'

/** Reads EXIF/XMP/IPTC/ICC/PNG text fields. Returns null if the file can't be parsed. */
async function readTags(bytes: Uint8Array<ArrayBuffer>): Promise<ExpandedTags | null> {
  try {
    // Loaded on demand so the parser never weighs down the initial page.
    const { default: ExifReader } = await import('exifreader')
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    return await ExifReader.load(buffer, { expanded: true, async: true })
  } catch {
    return null
  }
}

/**
 * Inspects an image entirely in memory. The container walk throws for corrupted
 * files; field-level parsing failures degrade to "unknown" statuses instead.
 */
export async function analyzeImageMetadata(
  bytes: Uint8Array<ArrayBuffer>,
  format: ImageFormat,
): Promise<MetadataAnalysis> {
  const inventory = inspectContainer(bytes, format)
  const tags = await readTags(bytes)
  return summarizeMetadata(inventory, tags, bytes)
}

export function useImageMetadata() {
  return { analyze: analyzeImageMetadata }
}
