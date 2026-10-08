<template>
  <div class="flex min-h-dvh flex-col">
    <a
      href="#main"
      class="sr-only z-50 rounded-md bg-(--cf-card) px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>
    <AppHeader />
    <main id="main" class="flex-1">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
