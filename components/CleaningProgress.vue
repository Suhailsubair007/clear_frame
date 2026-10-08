<script setup lang="ts">
import { CLEANING_STEPS, type CleaningStep } from '~/utils/cleaner'

/**
 * A fixed-height step indicator. It is always rendered (hidden when idle) so
 * starting a clean never pushes content around.
 */
const props = defineProps<{ current: CleaningStep | null; active: boolean }>()

const currentIndex = computed(() => CLEANING_STEPS.findIndex((step) => step.id === props.current))
const currentLabel = computed(() => CLEANING_STEPS[currentIndex.value]?.label ?? '')
</script>

<template>
  <div :class="{ invisible: !active }" :aria-hidden="!active">
    <ol class="flex gap-1.5" aria-label="Cleaning progress">
      <li
        v-for="(step, index) in CLEANING_STEPS"
        :key="step.id"
        class="h-1.5 flex-1 rounded-full transition-colors duration-300"
        :class="index <= currentIndex ? 'bg-primary' : 'bg-elevated'"
        :aria-current="index === currentIndex ? 'step' : undefined"
      >
        <span class="sr-only">
          {{ step.label }}
          {{ index < currentIndex ? '(complete)' : index === currentIndex ? '(in progress)' : '(pending)' }}
        </span>
      </li>
    </ol>
    <p class="mt-2 text-center text-xs text-muted" aria-hidden="true">
      Step {{ Math.max(currentIndex, 0) + 1 }} of {{ CLEANING_STEPS.length }} · {{ currentLabel }}
    </p>
  </div>
</template>
