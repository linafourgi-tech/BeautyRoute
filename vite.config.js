import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `vitest/config`'s defineConfig is a drop-in superset of `vite`'s own --
// same build/dev behavior, plus typing for the `test` block below. It does
// not change anything about `vite build`/`vite dev`/`vite preview`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
