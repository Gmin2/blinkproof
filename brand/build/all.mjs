import { execFileSync } from 'node:child_process'
for (const step of ['verify', 'mascot', 'logo', 'tokens', 'app', 'bitmap', 'og', 'social', 'gallery']) {
  try {
    execFileSync(process.execPath, [`build/${step}.mjs`], { stdio: 'inherit' })
  } catch {
    console.error(`${step} failed`)
    process.exit(1)
  }
}
