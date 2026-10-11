import { Icon } from '../icons/Icon'
import type { useMe } from './library'

// sign in with github, or who you are and a way out. nothing at all when the server has sign in off
export function Account({ me, compact = false }: { me: ReturnType<typeof useMe>; compact?: boolean }) {
  if (!me.loaded || !me.auth) return null
  if (!me.user)
    return (
      <button onClick={() => me.signIn()} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-panel px-2.5 text-[12px] font-medium text-ink hover:bg-hover">
        <Icon name="logo-github" size={14} />
        Sign in
      </button>
    )
  return (
    <span className="group flex h-8 items-center gap-2 rounded-[8px] pl-1 pr-1.5 text-[12px] text-ink hover:bg-hover">
      {me.user.avatar ? <img src={me.user.avatar} alt="" className="h-6 w-6 rounded-full border border-line" /> : <Icon name="logo-github" size={16} />}
      {!compact && <span className="max-w-[120px] truncate font-medium">{me.user.login}</span>}
      <button onClick={me.signOut} title="sign out" className="text-[11.5px] text-dim hover:text-ink">
        Sign out
      </button>
    </span>
  )
}
