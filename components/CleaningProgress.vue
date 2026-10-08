<script setup lang="ts">
import { CLEANING_STEPS, type CleaningStep } from '~/utils/cleaner'

const props = defineProps<{ current: CleaningStep | null }>()

const currentIndex = computed(() => CLEANING_STEPS.findIndex((step) => step.id === props.current))

function stateOf(index: number): 'done' | 'active' | 'pending' {
  if (index < currentIndex.value || props.current === 'done') return 'done'
  return index === currentIndex.value ? 'active' : 'pending'
}
</script>

<template>
  <ol aria-label="Cleaning progress" class="space-y-2.5">
    <li
      v-for="(step, index) in CLEANING_STEPS"
      :key="step.id"
      class="flex items-center gap-3 text-sm"
      :aria-current="stateOf(index) === 'active' ? 'step' : undefined"
    >
      <span
        class="flex size-6 items-center justify-center rounded-full"
        :class="{
          'bg-primary text-inverted': stateOf(index) === 'done',
          'bg-primary/10 text-primary': stateOf(index) === 'active',
          'bg-elevated text-dimmed': stateOf(index) === 'pending',
        }"
      >
        <UIcon v-if="stateOf(index) === 'done'" name="i-lucide-check" class="size-3.5" aria-hidden="true" />
        <UIcon
          v-else-if="stateOf(index) === 'active'"
          name="i-lucide-loader-circle"
          class="size-3.5 animate-spin"
          aria-hidden="true"
        />
        <span v-else class="size-1.5 rounded-full bg-current" aria-hidden="true" />
      </span>
      <span :class="stateOf(index) === 'pending' ? 'text-muted' : 'font-medium text-highlighted'">
        {{ step.label }}
        <span class="sr-only"
          >({{
            stateOf(index) === 'done' ? 'complete' : stateOf(index) === 'active' ? 'in progress' : 'pending'
          }})</span
        >
      </span>
    </li>
  </ol>
</template>
