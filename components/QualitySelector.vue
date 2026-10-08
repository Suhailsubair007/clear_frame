<script setup lang="ts">
import type { QualityMode } from '~/types/image'
import { QUALITY_OPTIONS } from '~/utils/image'

const props = defineProps<{ available: QualityMode[]; disabled?: boolean }>()
const model = defineModel<QualityMode>({ required: true })

const options = computed(() => QUALITY_OPTIONS.filter((option) => props.available.includes(option.mode)))
const name = useId()
</script>

<template>
  <div v-if="options.length === 1" class="flex items-start gap-3 rounded-xl bg-success/5 p-4 text-sm">
    <UIcon name="i-lucide-badge-check" class="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
    <p>
      <span class="font-semibold text-highlighted">Original quality.</span>
      <span class="text-toned"> Pixels stay exactly as they are — only metadata is removed.</span>
    </p>
  </div>
  <fieldset v-else :disabled="disabled">
    <legend class="text-sm font-semibold text-highlighted">Image quality</legend>
    <div class="mt-3 grid gap-2">
      <label
        v-for="option in options"
        :key="option.mode"
        class="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-primary"
        :class="model === option.mode ? 'border-primary bg-primary/5' : 'border-default hover:border-accented'"
      >
        <input v-model="model" type="radio" :name="name" :value="option.mode" class="mt-1 size-4 accent-primary" />
        <span>
          <span class="block text-sm font-medium text-highlighted">
            {{ option.label }}
            <span v-if="option.mode === 'original'" class="ml-1 text-xs font-normal text-muted">Recommended</span>
          </span>
          <span class="mt-0.5 block text-sm text-muted">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
