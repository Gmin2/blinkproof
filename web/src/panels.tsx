import type { Finding, Report, StepResult } from '@blinkproof/sim'

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Heading({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-dim">
      <span>{title}</span>
      {right}
    </div>
  )
}

export function Checks({ findings }: { findings: Finding[] }) {
  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warning').length
  return (
    <div className="border-b border-line">
      <Heading title="wiring checks" right={<span className={errors ? 'text-[#f87171]' : 'text-accent'}>{count(errors, 'error')} · {count(warnings, 'warning')}</span>} />
      {findings.length > 0 && (
        <ul className="max-h-40 space-y-1.5 overflow-auto px-4 pb-3 font-mono text-[11px] leading-4">
          {findings.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${f.severity === 'error' ? 'bg-[#f87171]' : f.severity === 'warning' ? 'bg-[#f59e0b]' : 'bg-dim'}`} />
              <span className={f.severity === 'info' ? 'text-dim' : 'text-ink'}>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TestSteps({ steps, report }: { steps: StepResult[]; report: Report | null }) {
  return (
    <div className="border-b border-line">
      <Heading title="test" right={report && <span className={report.ok ? 'text-accent' : 'text-[#f87171]'}>{report.ok ? 'passed' : 'failed'}</span>} />
      <ol className="max-h-72 overflow-auto px-4 pb-3 font-mono text-[11px] leading-5">
        {steps.map((st) => (
          <li key={st.index} className="rise flex gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.ok ? 'bg-accent' : 'bg-[#f87171]'}`} />
            <span className={st.ok ? 'text-ink' : 'text-[#f87171]'}>
              {st.name ?? st.kind}
              <span className="block text-dim">{st.detail}</span>
            </span>
          </li>
        ))}
        {!report && <li className="text-dim">running...</li>}
      </ol>
      {report?.failed && <pre className="mx-4 mb-3 whitespace-pre-wrap rounded bg-canvas px-3 py-2 text-[10px] leading-4 text-dim">{report.failed.bench}</pre>}
    </div>
  )
}

export function Serial({ text }: { text: string }) {
  return (
    <>
      <Heading title="serial" />
      <pre className="min-h-0 flex-1 overflow-auto px-4 pb-3 font-mono text-xs leading-5 text-ink">{text}</pre>
    </>
  )
}
