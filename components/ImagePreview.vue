<script setup lang="ts">
/** `width`/`height` let the browser reserve the right space before the image decodes. */
defineProps<{ src: string; alt: string; width: number; height: number }>()
</script>

<template>
  <div class="checkerboard flex items-center justify-center overflow-hidden rounded-2xl border border-default">
    <img
      :key="src"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      decoding="async"
      class="motion-fade-in block h-auto max-h-[min(55vh,30rem)] w-auto max-w-full object-contain"
    />
  </div>
</template>
