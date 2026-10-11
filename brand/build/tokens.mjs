// tokens.json to css variables and a ts theme
import tokens from '../tokens.json' with { type: 'json' }
import { out } from './lib.mjs'

const b = tokens.color.brand
const lines = (o, prefix) => Object.entries(o).map(([k, v]) => `  --${prefix}${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v};`)
const css = `/* generated from brand/tokens.json */
:root {
${lines(b, 'bp-').join('\n')}
${lines(tokens.color.ui.light, 'bp-ui-').join('\n')}
${Object.entries(tokens.radius).map(([k, v]) => `  --bp-radius-${k}: ${v}px;`).join('\n')}
  --bp-font: '${tokens.type.sans}', system-ui, sans-serif;
  --bp-mono: '${tokens.type.mono}', ui-monospace, monospace;
  --bp-ease: ${tokens.motion.ease};
  --bp-blink: ${tokens.motion.blinkOn + tokens.motion.blinkOff}ms;
}

:root[data-theme='dark'] {
${lines(tokens.color.ui.dark, 'bp-ui-').join('\n')}
}
`
out('kit/tokens/tokens.css', css)
out('kit/tokens/theme.ts', `// generated from brand/tokens.json\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const\n`)
out('kit/tokens/tokens.json', JSON.stringify(tokens, null, 2))
console.log('tokens: tokens.css, theme.ts')
