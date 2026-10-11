import { Icon, type IconName } from '../icons/Icon'

// a section: main ones in near black, the secondary level in grey, actions on the right
export function Section({ title, sub, children, right, first }: { title: React.ReactNode; sub?: boolean; children?: React.ReactNode; right?: React.ReactNode; first?: boolean }) {
  return (
    <section className={`px-4 ${first ? 'pt-1' : 'pt-5'}`}>
      <div className={`flex h-6 items-center justify-between text-[12px] font-semibold ${sub ? 'text-dim' : 'text-ink'}`}>
        <span className="flex items-center gap-1">{title}</span>
        <span className="flex items-center gap-1.5 font-normal">{right}</span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </section>
  )
}

export function Sep() {
  return <div className="mx-4 mt-5 border-t border-sep" />
}

// a field: grey label or icon inside on the left, the value in mono
export function Field({ label, icon, value, wide, menu }: { label?: string; icon?: IconName; value: React.ReactNode; wide?: boolean; menu?: boolean }) {
  return (
    <div className={`flex h-6 min-w-0 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px] ${wide ? 'col-span-2' : ''}`}>
      {icon ? <Icon name={icon} size={13} className="text-icon-2" /> : <span className="text-dim">{label}</span>}
      <span className={`min-w-0 flex-1 truncate text-ink ${menu ? 'text-left' : 'text-right font-mono'}`}>{value}</span>
      {menu && <Icon name="chevron-expand-y" size={11} className="text-icon-2" />}
    </div>
  )
}

