<script setup lang="ts">
const PROMISES = ['No image storage', 'No account required', 'No cloud processing', 'No image history']
</script>

<template>
  <section aria-labelledby="private-heading" class="card overflow-hidden p-6 sm:p-10">
    <div class="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div>
        <span class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon name="i-lucide-lock" class="size-5" aria-hidden="true" />
        </span>
        <h2 id="private-heading" class="mt-5 font-display text-3xl text-highlighted sm:text-4xl">Private by design</h2>
        <p class="mt-3 max-w-xl leading-relaxed text-muted">
          ClearFrame processes your images directly in your browser. Your images are not uploaded to a ClearFrame
          server.
        </p>
        <NuxtLink
          to="/privacy"
          class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Read how privacy works <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <li
          v-for="promise in PROMISES"
          :key="promise"
          class="flex items-center gap-3 rounded-xl border border-default px-4 py-3 font-medium text-highlighted"
        >
          <UIcon name="i-lucide-circle-check" class="size-5 text-primary" aria-hidden="true" />
          {{ promise }}
        </li>
      </ul>
    </div>
  </section>
</template>
