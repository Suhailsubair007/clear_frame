/**
 * Nuxt UI 3 installs @nuxt/schema v4 at the top level, whose fallback route-rule
 * type omits Nitro's `headers`. Nitro supports it at runtime; this restores the type.
 */
export {}

declare module '@nuxt/schema' {
  interface RouteRuleConfigExtensions {
    headers?: Record<string, string>
  }
}
