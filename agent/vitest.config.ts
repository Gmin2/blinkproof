import { defineConfig } from 'vitest/config'

// the first run compiles every sketch, later runs hit the cache
export default defineConfig({ test: { testTimeout: 60_000 } })
