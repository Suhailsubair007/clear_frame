<script setup lang="ts">
import type { CleanedImage } from '~/composables/useImageCleaner'
import type { SelectedImage } from '~/types/image'
import { formatBytes } from '~/utils/file'

/** Result panel. Shown in the same column as the metadata summary so the layout doesn't jump. */
const props = defineProps<{ image: SelectedImage; result: CleanedImage; canShare: boolean }>()
const emit = defineEmits<{ download: []; share: []; reset: [] }>()

const fullyClean = computed(() => props.result.outcomes.every((outcome) => outcome.outcome !== 'not-removed'))

const stats = computed(() => [
  { label: 'Original size', value: formatBytes(props.image.size) },
  { label: 'Cleaned size', value: formatBytes(props.result.blob.size) },
  { label: 'Metadata removed', value: String(props.result.removedCount) },
  { label: 'Kept or remaining', value: String(props.result.remainingCount) },
])

const summary = computed(() => {
  const { removedCount, fieldsRemoved, mode } = props.result
  if (removedCount === 0) return 'There was no metadata to remove. ClearFrame still made a fresh, verified copy.'
  const fields = fieldsRemoved ? ` (${fieldsRemoved} fields)` : ''
  const quality = mode === 'original' ? 'Pixels are untouched.' : 'The image was re-saved at the quality you chose.'
  return `Removed ${removedCount} kind${removedCount === 1 ? '' : 's'} of metadata${fields}. ${quality}`
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start gap-3.5">
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-xl"
        :class="fullyClean ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
      >
        <UIcon :name="fullyClean ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'" class="size-6" />
      </span>
      <div class="min-w-0">
        <h2 class="font-display text-2xl leading-tight text-highlighted" tabindex="-1" data-autofocus="done">
          {{ fullyClean ? 'Your image is clean and ready to share.' : 'Your image was cleaned, with exceptions.' }}
        </h2>
        <p class="mt-1.5 text-sm text-muted">{{ summary }}</p>
        <p class="mt-1 text-sm text-muted">
          Saved as <span class="font-medium break-all text-highlighted">{{ result.fileName }}</span>
        </p>
      </div>
    </div>

    <div class="grid gap-2">
      <UButton size="xl" icon="i-lucide-download" label="Download clean image" block @click="emit('download')" />
      <div class="grid gap-2" :class="{ 'sm:grid-cols-2': canShare }">
        <UButton
          v-if="canShare"
          size="lg"
          color="neutral"
          variant="subtle"
          icon="i-lucide-share"
          label="Share or save to Photos"
          block
          @click="emit('share')"
        />
        <UButton
          size="lg"
          color="neutral"
          variant="outline"
          icon="i-lucide-rotate-ccw"
          label="Clean another image"
          block
          @click="emit('reset')"
        />
      </div>
    </div>

    <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-default bg-(--ui-border)">
      <div v-for="stat in stats" :key="stat.label" class="bg-(--cf-card) px-4 py-3">
        <dt class="text-xs text-muted">{{ stat.label }}</dt>
        <dd class="mt-0.5 text-lg font-semibold text-highlighted tabular-nums">{{ stat.value }}</dd>
      </div>
    </dl>

    <section v-if="result.outcomes.length" aria-labelledby="outcome-heading">
      <h3 id="outcome-heading" class="text-base font-semibold text-highlighted">Before and after</h3>
      <div class="mt-3 overflow-hidden rounded-xl border border-default">
        <table class="w-full text-sm">
          <thead class="bg-muted text-left text-xs tracking-wider text-muted uppercase">
            <tr>
              <th scope="col" class="px-4 py-2.5 font-semibold">Metadata</th>
              <th scope="col" class="hidden px-4 py-2.5 font-semibold sm:table-cell">Before</th>
              <th scope="col" class="px-4 py-2.5 text-right font-semibold sm:text-left">After</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="outcome in result.outcomes" :key="outcome.id">
              <th scope="row" class="px-4 py-3 text-left align-top font-medium text-highlighted">
                {{ outcome.label }}
                <span v-if="outcome.note" class="mt-0.5 block text-xs font-normal text-muted">{{ outcome.note }}</span>
              </th>
              <td class="hidden px-4 py-3 align-top sm:table-cell"><StatusBadge status="found" /></td>
              <td class="px-4 py-3 text-right align-top sm:text-left"><StatusBadge :status="outcome.outcome" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <aside class="rounded-xl bg-muted p-4 text-sm" aria-labelledby="limits-heading">
      <p id="limits-heading" class="flex items-center gap-2 font-semibold text-highlighted">
        <UIcon name="i-lucide-info" class="size-4 text-muted" aria-hidden="true" />
        What metadata removal can't do
      </p>
      <p class="mt-2 text-toned">
        <strong class="font-medium text-highlighted"
          >Invisible watermarks and Content Credentials stored online.</strong
        >
        Some AI tools hide signals in the pixels themselves or keep provenance records on their own servers. This
        metadata type cannot currently be removed by ClearFrame.
      </p>
      <p class="mt-2 text-toned">
        Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited
        label. Platforms may use independent detection or provenance systems.
      </p>
    </aside>
  </div>
</template>
