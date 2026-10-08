import type { ExpandedTags } from 'exifreader'
import type {
  CategoryOutcome,
  ContainerBlock,
  ContainerInventory,
  MetadataAnalysis,
  MetadataCategory,
  MetadataCategoryId,
  MetadataField,
  MetadataGroup,
  ProvenanceFindings,
} from '~/types/metadata'
import { readAscii } from './binary'
import { AI_TEXT_KEYWORDS } from './containers/png'
import { needsOrientation } from './exif'
import { formatBytes } from './file'

export const CATEGORY_LABELS: Record<MetadataCategoryId, string> = {
  exif: 'EXIF',
  gps: 'GPS location',
  camera: 'Camera information',
  datetime: 'Date & time',
  software: 'Software',
  xmp: 'XMP',
  iptc: 'IPTC',
  ai: 'AI / provenance metadata',
  author: 'Author & copyright',
  description: 'Descriptions & comments',
  thumbnail: 'Embedded thumbnail',
  other: 'Other hidden data',
  orientation: 'Orientation',
  icc: 'Colour profile',
}

/** Always listed so users can see what was checked, even when absent. */
const PRIMARY_CATEGORIES: MetadataCategoryId[] = ['exif', 'gps', 'camera', 'datetime', 'software', 'xmp', 'iptc', 'ai']
/** Listed only when present. */
const EXTRA_CATEGORIES: MetadataCategoryId[] = ['author', 'description', 'thumbnail', 'other', 'orientation', 'icc']
const SENSITIVE_CATEGORIES = new Set<MetadataCategoryId>([
  'gps',
  'camera',
  'datetime',
  'author',
  'description',
  'thumbnail',
])

/** IPTC Digital Source Type values that describe algorithmic or AI-generated media. */
export const AI_SOURCE_TYPES: Record<string, string> = {
  trainedAlgorithmicMedia: 'Created with generative AI',
  compositeWithTrainedAlgorithmicMedia: 'Edited with generative AI',
  algorithmicMedia: 'Created by an algorithm',
  compositeSynthetic: 'Includes synthetic elements',
  algorithmicallyEnhanced: 'Algorithmically enhanced',
}

const AI_SOFTWARE_PATTERN =
  /\b(adobe firefly|firefly|dall[·\-\s]?e(?:\s?\d)?|midjourney|stable diffusion|novelai|comfyui|automatic1111|invokeai|imagen|chatgpt|openai|leonardo\.ai|ideogram|generative fill|bing image creator)\b/gi

const DIGITAL_SOURCE_TYPE_PATTERN = /digitalsourcetype\/([a-z]+)/gi

const TAG_GROUPS = ['exif', 'xmp', 'iptc', 'photoshop', 'pngText', 'makerNotes'] as const
type TagGroupName = (typeof TAG_GROUPS)[number]

const MAX_VALUE_LENGTH = 160
const MAX_FIELDS_PER_GROUP = 150

const CAMERA_TAGS = [
  'Make',
  'Model',
  'LensMake',
  'LensModel',
  'Lens',
  'BodySerialNumber',
  'SerialNumber',
  'LensSerialNumber',
  'CameraOwnerName',
]
const DATE_TAGS = [
  'DateTimeOriginal',
  'CreateDate',
  'DateTimeDigitized',
  'DateTime',
  'ModifyDate',
  'DateCreated',
  'MetadataDate',
  'GPSDateStamp',
  'Date Created',
  'Digital Creation Date',
  'Creation Time',
]
const SOFTWARE_TAGS = ['Software', 'CreatorTool', 'HostComputer', 'ProcessingSoftware', 'Originating Program']
const AUTHOR_TAGS = [
  'Artist',
  'Copyright',
  'XPAuthor',
  'creator',
  'rights',
  'By-line',
  'Copyright Notice',
  'Credit',
  'Author',
  'Owner',
  'OwnerName',
]
const DESCRIPTION_TAGS = [
  'ImageDescription',
  'UserComment',
  'XPComment',
  'XPTitle',
  'XPKeywords',
  'XPSubject',
  'description',
  'title',
  'subject',
  'Caption/Abstract',
  'Headline',
  'Keywords',
  'Description',
  'Title',
  'Comment',
]
const PLACE_TAGS = [
  'City',
  'State',
  'Country',
  'Location',
  'Sub-location',
  'Province/State',
  'Country/Primary Location Name',
]

const TEXT_KEYWORD_CATEGORIES: Record<string, MetadataCategoryId> = {
  software: 'software',
  author: 'author',
  copyright: 'author',
  'creation time': 'datetime',
  description: 'description',
  title: 'description',
  comment: 'description',
  disclaimer: 'description',
  warning: 'description',
  source: 'description',
}

type TagRecord = Record<string, unknown>

/** Makes untrusted metadata text safe and short for display (rendered as text, never HTML). */
export function cleanText(input: string, maxLength = MAX_VALUE_LENGTH): string {
  const text = input
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function describeTag(tag: unknown): string | undefined {
  if (tag === null || typeof tag !== 'object') return undefined
  const { description, value } = tag as { description?: unknown; value?: unknown }
  for (const candidate of [description, value]) {
    if (typeof candidate === 'string' && candidate.trim()) return cleanText(candidate)
    if (typeof candidate === 'number') return String(candidate)
  }
  return undefined
}

function getGroup(tags: ExpandedTags | null, group: TagGroupName): TagRecord {
  const record = tags?.[group] as TagRecord | undefined
  return record ?? {}
}

function findTag(tags: ExpandedTags | null, names: readonly string[]): string | undefined {
  for (const group of TAG_GROUPS) {
    const record = getGroup(tags, group)
    for (const name of names) {
      const value = describeTag(record[name])
      if (value) return value
    }
  }
  return undefined
}

function hasAnyTag(tags: ExpandedTags | null, names: readonly string[]): boolean {
  return findTag(tags, names) !== undefined
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`
}

function readLocation(tags: ExpandedTags | null): string | undefined {
  const gps = tags?.gps
  if (gps && typeof gps.Latitude === 'number' && typeof gps.Longitude === 'number') {
    return `${formatCoordinate(gps.Latitude, 'N', 'S')}, ${formatCoordinate(gps.Longitude, 'E', 'W')}`
  }
  if (hasAnyTag(tags, ['GPSLatitude', 'GPSLongitude'])) return 'GPS coordinates'
  return findTag(tags, PLACE_TAGS)
}

function readCamera(tags: ExpandedTags | null): string | undefined {
  const make = findTag(tags, ['Make'])
  const model = findTag(tags, ['Model'])
  if (make && model) return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  return (
    make ??
    model ??
    findTag(tags, CAMERA_TAGS) ??
    (Object.keys(getGroup(tags, 'makerNotes')).length ? 'Maker notes' : undefined)
  )
}

function textBlocks(inventory: ContainerInventory): ContainerBlock[] {
  return inventory.blocks.filter((block) => block.kind === 'text')
}

function textCategory(keyword: string | undefined): MetadataCategoryId | 'ai' {
  const normalized = (keyword ?? '').toLowerCase()
  if (AI_TEXT_KEYWORDS.has(normalized)) return 'ai'
  return TEXT_KEYWORD_CATEGORIES[normalized] ?? 'other'
}

function hasTextIn(inventory: ContainerInventory, category: MetadataCategoryId): boolean {
  return textBlocks(inventory).some((block) => textCategory(block.keyword) === category)
}

function blocksOfKind(inventory: ContainerInventory, ...kinds: ContainerBlock['kind'][]): ContainerBlock[] {
  return inventory.blocks.filter((block) => kinds.includes(block.kind))
}

/** Raw text of C2PA blocks; manifests store source types and tool names as plain strings. */
function c2paText(bytes: Uint8Array | undefined, inventory: ContainerInventory): string {
  if (!bytes) return ''
  return blocksOfKind(inventory, 'c2pa')
    .map((block) => readAscii(bytes, block.offset, Math.min(block.length, 2_000_000)))
    .join('\n')
}

function collectMatches(pattern: RegExp, sources: readonly string[]): string[] {
  const found = new Map<string, string>()
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1] ?? match[0]
      if (!found.has(value.toLowerCase())) found.set(value.toLowerCase(), value)
    }
  }
  return [...found.values()]
}

export function findProvenance(
  inventory: ContainerInventory,
  tags: ExpandedTags | null,
  bytes?: Uint8Array,
): ProvenanceFindings {
  const rawXmp = tags?.xmp?._raw ?? ''
  const manifestText = c2paText(bytes, inventory)
  const softwareValues = [findTag(tags, SOFTWARE_TAGS), findTag(tags, ['HistorySoftwareAgent', 'History'])].filter(
    (value): value is string => Boolean(value),
  )

  const sourceTypes = collectMatches(DIGITAL_SOURCE_TYPE_PATTERN, [
    rawXmp,
    manifestText,
    findTag(tags, ['DigitalSourceType']) ?? '',
  ])
  const digitalSourceType = sourceTypes.find((type) => type in AI_SOURCE_TYPES)

  return {
    c2pa: blocksOfKind(inventory, 'c2pa').length > 0,
    digitalSourceType,
    generationParameters: textBlocks(inventory)
      .filter((block) => textCategory(block.keyword) === 'ai')
      .map((block) => block.keyword ?? ''),
    softwareHints: collectMatches(AI_SOFTWARE_PATTERN, [...softwareValues, rawXmp, manifestText]),
  }
}

function hasProvenance(findings: ProvenanceFindings): boolean {
  return (
    findings.c2pa ||
    Boolean(findings.digitalSourceType) ||
    findings.generationParameters.length > 0 ||
    findings.softwareHints.length > 0
  )
}

export function describeProvenance(findings: ProvenanceFindings): string[] {
  const lines: string[] = []
  if (findings.c2pa) lines.push('Content Credentials (C2PA) manifest')
  if (findings.digitalSourceType) {
    lines.push(`Digital source type: ${AI_SOURCE_TYPES[findings.digitalSourceType] ?? findings.digitalSourceType}`)
  }
  if (findings.generationParameters.length) {
    lines.push(`Generation settings (${findings.generationParameters.join(', ')})`)
  }
  if (findings.softwareHints.length) lines.push(`Software: ${findings.softwareHints.join(', ')}`)
  return lines
}

function detectCategory(
  id: MetadataCategoryId,
  inventory: ContainerInventory,
  tags: ExpandedTags | null,
  provenance: ProvenanceFindings,
): { found: boolean; hint?: string } {
  switch (id) {
    case 'exif':
      return { found: blocksOfKind(inventory, 'exif').length > 0 }
    case 'xmp':
      return { found: blocksOfKind(inventory, 'xmp').length > 0 }
    case 'iptc':
      return { found: blocksOfKind(inventory, 'iptc').length > 0 }
    case 'icc':
      return {
        found: blocksOfKind(inventory, 'icc').length > 0,
        hint: describeTag((tags?.icc as TagRecord | undefined)?.['ICC Description']),
      }
    case 'gps': {
      const hint = readLocation(tags)
      return { found: Boolean(hint), hint }
    }
    case 'camera': {
      const hint = readCamera(tags)
      return { found: Boolean(hint), hint }
    }
    case 'datetime': {
      const hint = findTag(tags, DATE_TAGS)
      const fromChunks = blocksOfKind(inventory, 'timestamp').length > 0 || hasTextIn(inventory, 'datetime')
      return { found: Boolean(hint) || fromChunks, hint }
    }
    case 'software': {
      const hint = findTag(tags, SOFTWARE_TAGS)
      return { found: Boolean(hint) || hasTextIn(inventory, 'software'), hint }
    }
    case 'author': {
      const hint = findTag(tags, AUTHOR_TAGS)
      return { found: Boolean(hint) || hasTextIn(inventory, 'author'), hint }
    }
    case 'description': {
      const hint = findTag(tags, DESCRIPTION_TAGS)
      const comments = blocksOfKind(inventory, 'comment').length > 0 || hasTextIn(inventory, 'description')
      return { found: Boolean(hint) || comments, hint }
    }
    case 'thumbnail': {
      const thumbnail = tags?.Thumbnail
      const size = thumbnail?.image ? formatBytes(thumbnail.image.byteLength) : undefined
      const found = Boolean(thumbnail?.image) || blocksOfKind(inventory, 'thumbnail').length > 0
      return { found, hint: size ? `Preview image (${size})` : undefined }
    }
    case 'other': {
      const blocks = [
        ...blocksOfKind(inventory, 'other', 'multi-picture', 'trailer'),
        ...textBlocks(inventory).filter((block) => textCategory(block.keyword) === 'other'),
      ]
      const labels = [...new Set(blocks.map((block) => block.label.split(' · ').pop() ?? block.label))]
      return { found: blocks.length > 0, hint: labels.slice(0, 3).join(', ') || undefined }
    }
    case 'orientation':
      return { found: needsOrientation(inventory.orientation) }
    case 'ai': {
      const found = hasProvenance(provenance)
      return { found, hint: found ? describeProvenance(provenance).join(' · ') : undefined }
    }
  }
}

function buildCategories(
  inventory: ContainerInventory,
  tags: ExpandedTags | null,
  provenance: ProvenanceFindings,
  parseFailed: boolean,
): MetadataCategory[] {
  const categories: MetadataCategory[] = []
  for (const id of [...PRIMARY_CATEGORIES, ...EXTRA_CATEGORIES]) {
    const { found, hint } = detectCategory(id, inventory, tags, provenance)
    if (!found && EXTRA_CATEGORIES.includes(id)) continue
    // Field-level categories can't be ruled out if parsing failed.
    const fieldLevel = !['exif', 'xmp', 'iptc'].includes(id)
    const status = found ? 'found' : parseFailed && fieldLevel ? 'unknown' : 'not-found'
    categories.push({ id, label: CATEGORY_LABELS[id], status, hint, sensitive: SENSITIVE_CATEGORIES.has(id) })
  }
  return categories
}

function toFields(record: TagRecord, skip: (name: string) => boolean = () => false): MetadataField[] {
  const fields: MetadataField[] = []
  for (const [name, tag] of Object.entries(record)) {
    if (skip(name)) continue
    const value = describeTag(tag)
    if (value) fields.push({ label: name, value })
  }
  return fields
}

function limitFields(fields: MetadataField[]): MetadataField[] {
  if (fields.length <= MAX_FIELDS_PER_GROUP) return fields
  const hidden = fields.length - MAX_FIELDS_PER_GROUP
  return [...fields.slice(0, MAX_FIELDS_PER_GROUP), { label: '…', value: `${hidden} more fields` }]
}

const BLOCK_ACTION_TEXT: Record<ContainerBlock['action'], string> = {
  remove: 'Removed when cleaned',
  keep: 'Kept to preserve accurate colours',
}

function buildGroups(inventory: ContainerInventory, tags: ExpandedTags | null): MetadataGroup[] {
  const groups: MetadataGroup[] = []
  const location = readLocation(tags)
  if (tags?.gps && location) {
    const fields: MetadataField[] = [{ label: 'Coordinates', value: location }]
    if (typeof tags.gps.Altitude === 'number')
      fields.push({ label: 'Altitude', value: `${tags.gps.Altitude.toFixed(1)} m` })
    groups.push({ id: 'location', label: 'Location', fields })
  }

  const tagGroups: Array<[TagGroupName, string]> = [
    ['exif', 'EXIF'],
    ['xmp', 'XMP'],
    ['iptc', 'IPTC'],
    ['photoshop', 'Photoshop'],
    ['pngText', 'PNG text'],
    ['makerNotes', 'Maker notes'],
  ]
  for (const [group, label] of tagGroups) {
    const fields = toFields(getGroup(tags, group), (name) => name.startsWith('_'))
    if (fields.length) groups.push({ id: group, label, fields: limitFields(fields) })
  }

  if (tags?.Thumbnail?.image) {
    groups.push({
      id: 'thumbnail',
      label: 'Embedded thumbnail',
      fields: [{ label: 'Preview image', value: `JPEG, ${formatBytes(tags.Thumbnail.image.byteLength)}` }],
    })
  }

  const icc = toFields((tags?.icc as TagRecord | undefined) ?? {})
  if (icc.length) groups.push({ id: 'icc', label: 'Colour profile (kept)', fields: limitFields(icc) })

  if (inventory.blocks.length) {
    groups.push({
      id: 'structure',
      label: 'File structure',
      fields: inventory.blocks.map((block) => ({
        label: block.label,
        value: `${formatBytes(block.length)} · ${BLOCK_ACTION_TEXT[block.action]}`,
      })),
    })
  }
  return groups
}

function countFields(tags: ExpandedTags | null): number {
  let count = tags?.Thumbnail?.image ? 1 : 0
  for (const group of TAG_GROUPS) {
    count += Object.keys(getGroup(tags, group)).filter((name) => !name.startsWith('_')).length
  }
  return count
}

/** Combines the container inventory with parsed tags into a user-facing summary. */
export function summarizeMetadata(
  inventory: ContainerInventory,
  tags: ExpandedTags | null,
  bytes?: Uint8Array,
): MetadataAnalysis {
  const parseFailed = tags === null
  const provenance = findProvenance(inventory, tags, bytes)
  return {
    inventory,
    categories: buildCategories(inventory, tags, provenance, parseFailed),
    groups: buildGroups(inventory, tags),
    provenance,
    fieldCount: countFields(tags),
    exifTagNames: Object.keys(getGroup(tags, 'exif')),
    parseFailed,
  }
}

const KEPT_NOTES: Partial<Record<MetadataCategoryId, string>> = {
  icc: 'Kept so colours look the same. It describes colours, not you.',
  orientation: 'Kept so your photo stays the right way up. It holds no personal information.',
}

/** Compares analyses of the original and cleaned files, category by category. */
export function compareMetadata(before: MetadataAnalysis, after: MetadataAnalysis): CategoryOutcome[] {
  const outcomes: CategoryOutcome[] = []
  for (const category of before.categories) {
    if (category.status !== 'found') continue
    const remaining = after.categories.find((candidate) => candidate.id === category.id)
    const base = { id: category.id, label: category.label }

    if (!remaining || remaining.status === 'not-found') {
      outcomes.push({ ...base, outcome: 'removed' })
    } else if (KEPT_NOTES[category.id]) {
      outcomes.push({ ...base, outcome: 'kept', note: KEPT_NOTES[category.id] })
    } else if (category.id === 'exif' && after.exifTagNames.every((name) => name === 'Orientation')) {
      outcomes.push({ ...base, outcome: 'removed', note: 'Only the orientation tag remains.' })
    } else {
      outcomes.push({
        ...base,
        outcome: 'not-removed',
        note: 'This metadata type cannot currently be removed by ClearFrame.',
      })
    }
  }
  return outcomes
}
