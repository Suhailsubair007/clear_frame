import type { ImageFormat } from './image'

/** A metadata-carrying structure found inside an image container. */
export type MetadataBlockKind =
  | 'exif'
  | 'xmp'
  | 'iptc'
  | 'icc'
  | 'c2pa'
  | 'comment'
  | 'text'
  | 'timestamp'
  | 'thumbnail'
  | 'multi-picture'
  | 'trailer'
  | 'other'

export interface ContainerBlock {
  kind: MetadataBlockKind
  /** Human-readable name, e.g. "APP1 · EXIF" or "tEXt · parameters". */
  label: string
  offset: number
  length: number
  /** Whether cleaning removes this block or keeps it on purpose. */
  action: 'remove' | 'keep'
  /** PNG text chunk keyword, when relevant. */
  keyword?: string
}

/** Result of walking an image file's container structure. */
export interface ContainerInventory {
  format: ImageFormat
  /** Stored pixel dimensions from the image header (0 when unknown). */
  width: number
  height: number
  blocks: ContainerBlock[]
  /** EXIF orientation (1–8) when present. */
  orientation?: number
}

export interface StripResult {
  bytes: Uint8Array<ArrayBuffer>
  removed: ContainerBlock[]
  kept: ContainerBlock[]
  /** True when a minimal orientation-only EXIF block was written. */
  orientationPreserved: boolean
}

export type MetadataCategoryId =
  | 'exif'
  | 'gps'
  | 'camera'
  | 'datetime'
  | 'software'
  | 'xmp'
  | 'iptc'
  | 'ai'
  | 'author'
  | 'description'
  | 'thumbnail'
  | 'other'
  | 'icc'
  | 'orientation'

export type DetectionStatus = 'found' | 'not-found' | 'unknown'

export interface MetadataCategory {
  id: MetadataCategoryId
  label: string
  status: DetectionStatus
  /** Short human-readable example of what was found. */
  hint?: string
  /** True for data that can identify a person, place or device. */
  sensitive: boolean
}

export interface ProvenanceFindings {
  /** Embedded C2PA / Content Credentials manifest (JUMBF). */
  c2pa: boolean
  /** IPTC Digital Source Type indicating algorithmic or AI media. */
  digitalSourceType?: string
  /** PNG text keywords that typically hold AI generation parameters. */
  generationParameters: string[]
  /** Software names commonly associated with AI tools. */
  softwareHints: string[]
}

export interface MetadataField {
  label: string
  value: string
}

export interface MetadataGroup {
  id: string
  label: string
  fields: MetadataField[]
}

export interface MetadataAnalysis {
  inventory: ContainerInventory
  categories: MetadataCategory[]
  groups: MetadataGroup[]
  provenance: ProvenanceFindings
  /** Number of individual metadata fields read (excluding file structure). */
  fieldCount: number
  /** EXIF tag names present (used to recognise orientation-only EXIF). */
  exifTagNames: string[]
  /** True when field-level parsing failed; container inventory is still valid. */
  parseFailed: boolean
}

export type CleaningOutcome = 'removed' | 'kept' | 'not-removed'

export interface CategoryOutcome {
  id: MetadataCategoryId
  label: string
  outcome: CleaningOutcome
  note?: string
}
