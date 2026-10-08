<script setup lang="ts">
const PROMISES = ['No image storage', 'No account required', 'No cloud processing', 'No image history']
</script>

<template>
  <section aria-labelledby="private-heading" class="card reveal p-6 sm:p-10">
    <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div>
        <h2 id="private-heading" class="font-display text-3xl text-highlighted sm:text-4xl">Private by design</h2>
        <p class="mt-3 max-w-md leading-relaxed text-muted">
          ClearFrame processes your images directly in your browser. Your images are not uploaded to a ClearFrame
          server.
        </p>
      </div>
      <ul class="grid gap-3 sm:grid-cols-2">
        <li
          v-for="promise in PROMISES"
          :key="promise"
          class="flex items-center gap-3 rounded-xl border border-default px-4 py-3 font-medium text-highlighted"
        >
          <UIcon name="i-lucide-circle-check" class="size-5 shrink-0 text-primary" aria-hidden="true" />
          {{ promise }}
        </li>
      </ul>
    </div>
  </section>
</template>
