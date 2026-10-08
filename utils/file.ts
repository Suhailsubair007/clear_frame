import type { ImageFormat } from '~/types/image'

const FORMAT_EXTENSIONS: Record<ImageFormat, readonly string[]> = {
  jpeg: ['jpg', 'jpeg', 'jpe', 'jfif'],
  png: ['png'],
  webp: ['webp'],
}

const MAX_BASE_LENGTH = 100

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

export function splitFileName(name: string): { base: string; extension: string } {
  const fileName = name.split(/[/\\]/).pop() ?? ''
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return { base: fileName, extension: '' }
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot + 1) }
}

export function getExtension(name: string): string {
  return splitFileName(name).extension.toLowerCase()
}

/** Removes characters that are unsafe in file names on common operating systems. */
export function sanitizeFileBase(base: string): string {
  const cleaned = base
    .replace(/[\p{Cc}<>:"/\\|?*]+/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .trim()
  return cleaned || 'image'
}

/**
 * Builds a download name such as `IMG_1234-clean.jpg` that never equals the
 * original name and skips names already produced in this session.
 */
export function buildCleanFileName(
  originalName: string,
  format: ImageFormat,
  taken: ReadonlySet<string> = new Set(),
): string {
  const { base, extension } = splitFileName(originalName)
  const allowed = FORMAT_EXTENSIONS[format]
  const outputExtension = allowed.includes(extension.toLowerCase()) ? extension : (allowed[0] as string)

  const sanitized = sanitizeFileBase(base)
  const existingSuffix = /^(.*)-clean(?:-(\d+))?$/i.exec(sanitized)
  const root = existingSuffix?.[1] || (existingSuffix ? 'image' : sanitized)
  let counter = existingSuffix ? Number(existingSuffix[2] ?? 1) + 1 : 1

  const candidate = (n: number) => `${root}-clean${n === 1 ? '' : `-${n}`}.${outputExtension}`
  const isTaken = (name: string) => taken.has(name.toLowerCase()) || name.toLowerCase() === originalName.toLowerCase()
  while (isTaken(candidate(counter))) counter++
  return candidate(counter)
}
