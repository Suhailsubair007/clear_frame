<script setup lang="ts">
import type { SelectedImage } from '~/types/image'
import { formatBytes } from '~/utils/file'
import { FORMAT_LABELS } from '~/utils/image'

const props = defineProps<{ image: SelectedImage }>()

const rows = computed(() => [
  { label: 'File name', value: props.image.name, wide: true },
  { label: 'Format', value: FORMAT_LABELS[props.image.format] },
  { label: 'File size', value: formatBytes(props.image.size) },
  { label: 'Width', value: `${props.image.width.toLocaleString()} px` },
  { label: 'Height', value: `${props.image.height.toLocaleString()} px` },
])
</script>

<template>
  <section aria-labelledby="image-info-heading">
    <h2 id="image-info-heading" class="text-sm font-semibold text-highlighted">Image information</h2>
    <dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div v-for="row in rows" :key="row.label" :class="{ 'col-span-2': row.wide }">
        <dt class="text-muted">{{ row.label }}</dt>
        <dd class="mt-0.5 truncate font-medium text-highlighted" :title="row.value">{{ row.value }}</dd>
      </div>
    </dl>
  </section>
</template>
