/**
 * Response headers that make the privacy promise enforceable by the browser:
 * `connect-src 'self'` blocks fetch/XHR/beacons to any other origin, and
 * `img-src` only allows same-origin, blob: and data: images.
 * Inline scripts are needed for Nuxt's hydration payload and colour-mode script.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],

  app: {
    // Quick fade between pages; styles live in assets/css/main.css (skipped for reduced motion).
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      // Standard favicon set: ICO for legacy browsers, SVG for modern ones,
      // Apple touch icon for iOS home screens, manifest icons for Android/PWA.
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fafaf9', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0c0a09', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },

  typescript: {
    strict: true,
  },

  /** Icons are bundled at build time; no runtime requests to an icon CDN. */
  icon: {
    // Inline SVG instead of CSS masks: CSS mode injects a stylesheet at runtime that
    // declares Tailwind's `components` layer before `base`, breaking the cascade.
    mode: 'svg',
    provider: 'none',
    serverBundle: 'local',
    clientBundle: {
      scan: true,
      icons: [
        'lucide:check',
        'lucide:chevron-down',
        'lucide:x',
        'lucide:sun',
        'lucide:moon',
        'lucide:loader-circle',
        'lucide:circle-check',
        'lucide:circle-x',
        'lucide:info',
        'lucide:triangle-alert',
      ],
    },
  },

  /**
   * Fonts are downloaded at build time and served from this site.
   * Both are variable fonts, so they're declared with weight ranges; fixed
   * weights would make browsers render the variable file at its default weight.
   */
  fonts: {
    families: [
      { name: 'Geist', weights: ['100 900'], styles: ['normal'] },
      { name: 'Plus Jakarta Sans', weights: ['200 800'], styles: ['normal'] },
    ],
  },

  routeRules: {
    '/': { prerender: true },
    '/about': { prerender: true },
    '/privacy': { prerender: true },
  },

  nitro: {
    routeRules: {
      // Only in production: the dev server's hot-reload connections would be blocked.
      '/**': process.env.NODE_ENV === 'production' ? { headers: securityHeaders } : {},
    },
  },

  eslint: {
    config: { stylistic: false },
  },
})
