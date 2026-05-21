/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { resolve } from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, '**/node_modules/**', '**/dist/**', '**/.next/**'],
    isolate: true,
    setupFiles: ['./vitest.storage.setup.ts'],
    // Pool selection (`forks`) and concurrency caps live in package.json's
    // test script as CLI flags — Vitest 4's `poolOptions` field is no
    // longer in the public type so writing it here fails type-check.
    //
    // Default `threads` pool shared module cache between workers, which
    // made `vi.mock('@/db')` factories race in ~10 of our suites
    // (symptoms: "innerJoin is not a function", 5s timeouts on tests
    // that pass cleanly when run in isolation). Forks fix that by
    // giving each test file its own process.
    //
    // 5s was too tight when several heavy suites import the full Next.js
    // app graph; bump to 15s so genuine async work has room without
    // masking real hangs.
    testTimeout: 15000,
    hookTimeout: 15000,
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  resolve: {
    alias: [
      {
        find: '@/lib/logs/console-logger',
        replacement: path.resolve(__dirname, 'lib/logs/console-logger.ts'),
      },
      {
        find: '@/stores/console/store',
        replacement: path.resolve(__dirname, 'stores/console/store.ts'),
      },
      {
        find: '@/stores/execution/store',
        replacement: path.resolve(__dirname, 'stores/execution/store.ts'),
      },
      {
        find: '@/blocks/types',
        replacement: path.resolve(__dirname, 'blocks/types.ts'),
      },
      {
        find: '@/serializer/types',
        replacement: path.resolve(__dirname, 'serializer/types.ts'),
      },
      { find: '@/lib', replacement: path.resolve(__dirname, 'lib') },
      { find: '@/stores', replacement: path.resolve(__dirname, 'stores') },
      {
        find: '@/components',
        replacement: path.resolve(__dirname, 'components'),
      },
      { find: '@/app', replacement: path.resolve(__dirname, 'app') },
      { find: '@/api', replacement: path.resolve(__dirname, 'app/api') },
      {
        find: '@/executor',
        replacement: path.resolve(__dirname, 'executor'),
      },
      {
        find: '@/providers',
        replacement: path.resolve(__dirname, 'providers'),
      },
      { find: '@/tools', replacement: path.resolve(__dirname, 'tools') },
      { find: '@/blocks', replacement: path.resolve(__dirname, 'blocks') },
      {
        find: '@/serializer',
        replacement: path.resolve(__dirname, 'serializer'),
      },
      { find: '@', replacement: path.resolve(__dirname) },
    ],
  },
})
