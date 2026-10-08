// @ts-check
import prettier from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'vue/no-v-html': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['scripts/**', 'tests/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
)
