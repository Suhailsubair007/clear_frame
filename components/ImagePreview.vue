<script setup lang="ts">
defineProps<{ src: string; alt: string; compact?: boolean }>()
</script>

<template>
  <div class="checkerboard flex items-center justify-center overflow-hidden rounded-2xl border border-default">
    <img
      :src="src"
      :alt="alt"
      decoding="async"
      class="block h-auto w-auto max-w-full object-contain"
      :class="compact ? 'max-h-56 sm:max-h-64' : 'max-h-[min(55vh,30rem)]'"
    />
  </div>
</template>
