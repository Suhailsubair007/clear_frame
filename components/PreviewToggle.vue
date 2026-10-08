<script setup lang="ts">
/** Switches the preview between the original and cleaned image without changing layout. */
const showOriginal = defineModel<boolean>({ required: true })

const OPTIONS = [
  { label: 'Before', original: true },
  { label: 'After', original: false },
]
</script>

<template>
  <div class="inline-flex rounded-lg bg-elevated p-0.5 text-sm font-medium" role="group" aria-label="Preview">
    <button
      v-for="option in OPTIONS"
      :key="option.label"
      type="button"
      class="min-h-8 rounded-md px-3 transition-colors"
      :class="
        showOriginal === option.original
          ? 'bg-(--cf-card) text-highlighted shadow-sm'
          : 'text-muted hover:text-highlighted'
      "
      :aria-pressed="showOriginal === option.original"
      @click="showOriginal = option.original"
    >
      {{ option.label }}
    </button>
  </div>
</template>
