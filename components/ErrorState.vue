<script setup lang="ts">
import type { UserFacingError } from '~/utils/errors'

defineProps<{ error: UserFacingError }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="card motion-fade-up relative flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center sm:min-h-96 sm:px-10"
    role="alert"
  >
    <span
      class="motion-pop flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error"
      style="--delay: 120ms"
    >
      <UIcon name="i-lucide-image-off" class="size-7" aria-hidden="true" />
    </span>
    <h2 class="mt-5 text-xl font-semibold text-highlighted" tabindex="-1" data-autofocus="error">{{ error.title }}</h2>
    <p class="mx-auto mt-2 max-w-md text-muted">{{ error.description }}</p>
    <UButton class="mt-7" size="xl" icon="i-lucide-image-up" label="Try another image" @click="emit('retry')" />
  </div>
</template>
