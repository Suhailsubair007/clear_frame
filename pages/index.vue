<script setup lang="ts">
import { CLEANING_STEPS } from '~/utils/cleaner'
import { toUserFacingError } from '~/utils/errors'

const {
  phase,
  image,
  analysis,
  result,
  error,
  currentStep,
  mode,
  availableModes,
  statusMessage,
  selectFile,
  clean,
  reset,
} = useImageCleaner()
const { download, share, canShareFile } = useFileDownload()
const toast = useToast()

const workspace = ref<HTMLElement | null>(null)
const dropzone = ref<{ focus: () => void } | null>(null)
const showOriginal = ref(false)
/** The staggered entrance plays on first load only; later the upload card appears immediately. */
const introPlayed = ref(false)

/** The two-column workspace stays mounted from review to result, so nothing jumps between steps. */
const inWorkspace = computed(() => phase.value === 'ready' || phase.value === 'cleaning' || phase.value === 'done')
const isDone = computed(() => phase.value === 'done' && result.value !== null)
const aiFound = computed(() => analysis.value?.categories.some((c) => c.id === 'ai' && c.status === 'found') ?? false)
const canShare = computed(() => (result.value ? canShareFile(result.value.blob, result.value.fileName) : false))
const stepLabel = computed(() => CLEANING_STEPS.find((step) => step.id === currentStep.value)?.label ?? 'Cleaning…')
const previewSrc = computed(() =>
  isDone.value && result.value && !showOriginal.value ? result.value.objectUrl : (image.value?.objectUrl ?? ''),
)

/** Sticky header height plus breathing room; anything above this line is hidden behind the header. */
const HEADER_OFFSET = 80

/**
 * Moves focus to the new state for keyboard and screen-reader users. The page only
 * scrolls when the new heading is hidden above the viewport (content collapsed above
 * the reader), and never animates. On small screens the sticky bar shows the next action.
 */
watch(phase, async (next, previous) => {
  introPlayed.value = true
  if (next === 'done') showOriginal.value = false
  await nextTick()
  if (next === 'idle') {
    if (previous !== 'loading') dropzone.value?.focus()
    return
  }
  const target = workspace.value?.querySelector<HTMLElement>(`[data-autofocus="${next}"]`)
  if (!target) return
  const top = (target.closest('.card') ?? target).getBoundingClientRect().top
  if (top < HEADER_OFFSET) {
    window.scrollTo({ top: window.scrollY + top - HEADER_OFFSET, behavior: 'instant' })
  }
  target.focus({ preventScroll: true })
})

function notify(caught: unknown) {
  const friendly = toUserFacingError(caught, 'download-failed')
  toast.add({ title: friendly.title, description: friendly.description, color: 'error', icon: 'i-lucide-circle-x' })
}

function onDownload() {
  if (!result.value) return
  try {
    download(result.value.blob, result.value.fileName)
  } catch (caught) {
    notify(caught)
  }
}

async function onShare() {
  if (!result.value) return
  await share(result.value.blob, result.value.fileName).catch(notify)
}

/** Accept drops anywhere on the page, and stop the browser from navigating to the file. */
function onWindowDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
}

function onWindowDrop(event: DragEvent) {
  if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file && phase.value !== 'loading' && phase.value !== 'cleaning') selectFile(file)
}

onMounted(() => {
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('drop', onWindowDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDrop)
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6" :class="{ 'pb-24 lg:pb-0': inWorkspace }">
    <p class="sr-only" role="status" aria-live="polite">{{ statusMessage }}</p>

    <section class="pt-12 pb-10 text-center sm:pt-20 sm:pb-14">
      <h1 class="mx-auto max-w-3xl font-display text-[2.5rem] leading-[1.05] text-highlighted sm:text-6xl lg:text-7xl">
        <span class="motion-focus-in block">Your photos.</span>
        <span class="motion-focus-in block text-primary-600 dark:text-primary-400" style="--delay: 140ms">
          Your privacy.
        </span>
      </h1>
      <p class="motion-fade-up mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted" style="--delay: 320ms">
        Clean unwanted image metadata before you share. Process your photos directly on your device with no uploads or
        cloud storage.
      </p>
    </section>

    <div ref="workspace" class="scroll-mt-24">
      <UploadDropzone
        v-if="phase === 'idle' || phase === 'loading'"
        ref="dropzone"
        :loading="phase === 'loading'"
        :intro-delay="introPlayed ? 0 : 420"
        @select="selectFile"
      />

      <ErrorState v-else-if="phase === 'error' && error" :error="error" @retry="reset" />

      <div
        v-else-if="inWorkspace && image && analysis"
        class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start"
      >
        <div class="card motion-fade-up space-y-6 p-4 sm:p-6 lg:sticky lg:top-24">
          <div class="flex min-h-9 items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-highlighted" tabindex="-1" data-autofocus="ready">
              {{ isDone ? 'Preview' : 'Review your image' }}
            </h2>
            <PreviewToggle v-if="isDone" v-model="showOriginal" />
            <UButton
              v-else
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-x"
              label="Choose another"
              :disabled="phase === 'cleaning'"
              @click="reset"
            />
          </div>
          <ImagePreview
            :src="previewSrc"
            :alt="isDone && !showOriginal ? `Cleaned: ${result?.fileName}` : `Preview of ${image.name}`"
            :width="image.width"
            :height="image.height"
          />
          <ImageInfo :image="image" />
        </div>

        <div class="card motion-fade-up p-4 sm:p-6" style="--delay: 60ms">
          <CleaningResult
            v-if="isDone && result"
            :image="image"
            :result="result"
            :can-share="canShare"
            @download="onDownload"
            @share="onShare"
            @reset="reset"
          />
          <div v-else class="space-y-5">
            <MetadataSummary :categories="analysis.categories" />
            <ProvenanceNotice v-if="aiFound" :provenance="analysis.provenance" />
            <p v-if="analysis.parseFailed" class="text-sm text-muted">
              Some details couldn’t be read, but ClearFrame can still remove the metadata blocks it found.
            </p>
            <MetadataDetails :groups="analysis.groups" />
            <QualitySelector v-model="mode" :available="availableModes" :disabled="phase === 'cleaning'" />
            <div class="hidden space-y-3 lg:block">
              <UButton
                size="xl"
                block
                icon="i-lucide-eraser"
                :loading="phase === 'cleaning'"
                :label="phase === 'cleaning' ? 'Cleaning…' : 'Clean image'"
                @click="clean"
              />
              <CleaningProgress :current="currentStep" :active="phase === 'cleaning'" />
            </div>
            <PrivacyNotice />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="inWorkspace"
      class="fixed inset-x-0 bottom-0 z-20 border-t border-default bg-(--cf-page)/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
    >
      <UButton
        v-if="isDone"
        size="xl"
        block
        icon="i-lucide-download"
        label="Download clean image"
        @click="onDownload"
      />
      <UButton
        v-else
        size="xl"
        block
        icon="i-lucide-eraser"
        :loading="phase === 'cleaning'"
        :label="phase === 'cleaning' ? stepLabel : 'Clean image'"
        @click="clean"
      />
    </div>

    <div class="mt-24 space-y-24">
      <LazyHowItWorks />
      <LazyPrivacySection />
      <LazyAiMetadataSection />
    </div>
  </div>
</template>
