import { defineConfig, configDefaults } from 'vitest/config'
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
    // supabase/functions/** are Deno Edge Function tests (Deno.test, Deno.env,
    // https:// imports) run via `deno test`, not Vitest -- Vitest's default
    // include glob would otherwise pick up these *.test.ts files too and
    // fail trying to resolve Deno-only syntax under Node. Extends (not
    // replaces) Vitest's own default excludes.
    exclude: [...configDefaults.exclude, 'supabase/functions/**'],
  },
})
