<script setup lang="ts">
import { ACCEPT_ATTRIBUTE } from '~/utils/validation'

const props = defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ select: [file: File] }>()

const inputId = useId()
const hintId = useId()
const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
let dragDepth = 0

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) emit('select', file)
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth++
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && !props.loading) emit('select', file)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div
    class="card group relative transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-primary"
    :class="dragging ? 'border-primary bg-primary/5' : 'hover:border-accented'"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <span
      class="viewfinder"
      :class="dragging ? 'inset-5! [--vf-color:var(--ui-primary)]' : 'group-hover:[--vf-color:var(--ui-text-dimmed)]'"
      aria-hidden="true"
    />
    <label
      :for="inputId"
      class="relative flex min-h-80 cursor-pointer flex-col items-center justify-center gap-3 px-6 py-14 text-center sm:min-h-96"
      :class="{ 'cursor-progress': loading }"
    >
      <span class="mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-7 animate-spin" />
        <UIcon v-else name="i-lucide-image-up" class="size-7" />
      </span>
      <span class="text-lg font-semibold text-highlighted">{{ loading ? 'Reading your image…' : 'Upload image' }}</span>
      <template v-if="!loading">
        <span class="text-muted pointer-coarse:hidden">Drag &amp; drop your image here</span>
        <span class="text-sm text-dimmed pointer-coarse:hidden">or</span>
        <span
          class="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-inverted shadow-sm transition group-hover:brightness-110"
        >
          <UIcon name="i-lucide-folder-open" class="size-4" />
          <span class="pointer-coarse:hidden">Browse files</span>
          <span class="hidden pointer-coarse:inline">Choose a photo</span>
        </span>
      </template>
      <span :id="hintId" class="mt-3 text-xs font-medium tracking-wider text-dimmed uppercase">
        JPG · PNG · WebP · JPEG — up to 50 MB
      </span>
    </label>
    <input
      :id="inputId"
      ref="input"
      type="file"
      class="sr-only"
      :accept="ACCEPT_ATTRIBUTE"
      :disabled="loading"
      aria-label="Choose an image to clean"
      :aria-describedby="hintId"
      @change="onChange"
    />
  </div>
</template>
