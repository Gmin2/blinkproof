import OpenAI from 'openai'

// every model goes through an openai style client: the hackathon litellm proxy, openai itself,
// or anthropic's openai compatible endpoint. a provider shows up once its key is in .env
export type Model = { id: string; provider: 'litellm' | 'openai' | 'anthropic'; label: string }

const PROXY: Model[] = [
  { id: 'claude-haiku', provider: 'litellm', label: 'claude haiku 4.5' },
  { id: 'claude-sonnet-4.6', provider: 'litellm', label: 'claude sonnet 4.6' },
  { id: 'claude-opus-4.6', provider: 'litellm', label: 'claude opus 4.6' },
  { id: 'nova-pro', provider: 'litellm', label: 'nova pro' },
  { id: 'nova-2-lite', provider: 'litellm', label: 'nova 2 lite' },
  { id: 'nova-lite', provider: 'litellm', label: 'nova lite' },
  { id: 'nova-micro', provider: 'litellm', label: 'nova micro' },
]

// the newest claude models, used when the anthropic api cannot list its own
const ANTHROPIC_FALLBACK = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1']

export function client(provider: Model['provider']) {
  if (provider === 'openai') return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  if (provider === 'anthropic') return new OpenAI({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com/v1/' })
  return new OpenAI({ apiKey: process.env.LITELLM_API_KEY, baseURL: process.env.LITELLM_BASE_URL })
}

let cache: Model[] | undefined

export async function listModels() {
  if (cache) return cache
  const out: Model[] = process.env.LITELLM_API_KEY ? [...PROXY] : []
  if (process.env.ANTHROPIC_API_KEY) {
    let ids = ANTHROPIC_FALLBACK
    try {
      const page = await client('anthropic').models.list()
      const found = page.data.map((m) => m.id).filter((id) => id.startsWith('claude-'))
      if (found.length) ids = found
    } catch {}
    out.push(...ids.map((id) => ({ id, provider: 'anthropic' as const, label: id })))
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const page = await client('openai').models.list()
      const ids = page.data
        .map((m) => m.id)
        .filter((id) => /^(gpt-|o\d)/.test(id) && !/(audio|realtime|transcribe|tts|image|search|instruct)/.test(id))
        .sort()
        .reverse()
      out.push(...ids.map((id) => ({ id, provider: 'openai' as const, label: id })))
    } catch (e) {
      console.error(`openai models: ${(e as Error).message}`)
    }
  }
  cache = out
  return out
}

export async function findModel(id: string) {
  const models = await listModels()
  return models.find((m) => m.id === id) ?? { id, provider: 'litellm' as const, label: id }
}
