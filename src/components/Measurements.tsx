import { useState } from 'react'
import { Section } from './ui'
import { formatDay, todayISO, addDays } from '../lib/date'
import { useStore } from '../store'
import type { AppState, Measurement } from '../types'

export type MeasureKey = 'hips' | 'waist' | 'chest'

export const MEASURES: { key: MeasureKey; label: string; how: string }[] = [
  { key: 'chest', label: 'Грудь', how: 'По самым выступающим точкам груди и под лопатками, лента горизонтально. Руки опущены, на спокойном выдохе. В одном и том же белье.' },
  { key: 'waist', label: 'Талия', how: 'В самом узком месте (обычно на 2–3 см выше пупка). Живот не втягивать, мерить на спокойном выдохе.' },
  { key: 'hips', label: 'Бёдра', how: 'По самой выступающей точке ягодиц, стоя, стопы вместе. Лента горизонтально, сбоку проверь в зеркале.' },
]

const DAY = 24 * 3600 * 1000
const monthsBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY / 30.44

export const fmtCm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
export const fmtDelta = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtCm(Math.abs(v))}`

/** Стартовый и последний замер по каждому обхвату, прирост и прирост в месяц */
export const measureStats = (state: AppState) => {
  const list = state.measurements ?? []
  const start = list.find((m) => m.id === state.measureStart) ?? list[0]
  const out: Partial<Record<MeasureKey, { from: number; to: number; delta: number; months: number; perMonth?: number }>> = {}
  if (!start) return { start, stats: out }
  for (const { key } of MEASURES) {
    const first = list.find((m) => m.date >= start.date && m[key] !== undefined)
    const last = [...list].reverse().find((m) => m[key] !== undefined && m.date >= start.date)
    if (!first || !last) continue
    const months = monthsBetween(first.date, last.date)
    const delta = last[key]! - first[key]!
    out[key] = { from: first[key]!, to: last[key]!, delta, months, perMonth: months >= 0.5 ? delta / months : undefined }
  }
  return { start, stats: out }
}

export function MeasurementsSection() {
  const { state, dispatch } = useStore()
  const list = state.measurements ?? []
  const { start, stats } = measureStats(state)
  const [adding, setAdding] = useState(list.length === 0)
  const [how, setHow] = useState(false)
  const [draft, setDraft] = useState<{ date: string } & Record<MeasureKey, string>>({ date: todayISO(), hips: '', waist: '', chest: '' })
  const last = list[list.length - 1]
  const nextDate = last ? addDays(last.date, 30) : undefined

  const save = () => {
    const num = (v: string) => {
      const n = parseFloat(v.replace(',', '.'))
      return isFinite(n) && n > 20 && n < 250 ? n : undefined
    }
    const m: Measurement = { id: `m-${Date.now()}`, date: draft.date, hips: num(draft.hips), waist: num(draft.waist), chest: num(draft.chest) }
    if (m.hips === undefined && m.waist === undefined && m.chest === undefined) return
    dispatch({ type: 'measure', m })
    setDraft({ date: todayISO(), hips: '', waist: '', chest: '' })
    setAdding(false)
  }

  return (
    <Section eyebrow="Раз в месяц" title="Замеры тела">
      {list.length > 0 && start && (
        <>
          <BodyFigure stats={stats} />
          <p className="muted small" style={{ margin: 0 }}>
            Салатовым — изменение от старта ({formatDay(start.date)}): снаружи силуэта прибавка, внутри убавка. Масштаб увеличен, чтобы было видно.
          </p>
        </>
      )}

      {list.length > 0 && (
        <div className="measure-table">
          <div className="mt-row mt-head">
            <span>Дата</span>
            {MEASURES.map((m) => (
              <span key={m.key}>{m.label}</span>
            ))}
            <span />
          </div>
          {list.map((m) => {
            const isStart = m.id === start?.id
            return (
              <div key={m.id} className={`mt-row ${isStart ? 'mt-start' : ''}`}>
                <span>
                  {formatDay(m.date)}
                  {m.date.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${m.date.slice(2, 4)}` : ''}
                  <button className={`mt-flag ${isStart ? 'on' : ''}`} onClick={() => dispatch({ type: 'measureStart', id: isStart ? undefined : m.id })}>
                    {isStart ? 'старт' : 'сделать стартом'}
                  </button>
                </span>
                {MEASURES.map(({ key }) => {
                  const v = m[key]
                  const base = start?.[key]
                  const d = v !== undefined && base !== undefined && start && m.date > start.date ? v - base : undefined
                  return (
                    <span key={key}>
                      {v !== undefined ? fmtCm(v) : '—'}
                      {d !== undefined && <small className={d === 0 ? '' : 'mt-delta'}>{fmtDelta(d)}</small>}
                    </span>
                  )
                })}
                <button className="mt-del" aria-label="Удалить замер" onClick={() => confirm('Удалить этот замер?') && dispatch({ type: 'removeMeasure', id: m.id })}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {list.length > 1 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {MEASURES.map(({ key, label }) => {
            const st = stats[key]
            if (!st) return null
            return (
              <span key={key} className="chip">
                {label}: {fmtDelta(st.delta)} см{st.perMonth !== undefined ? ` · ${fmtDelta(st.perMonth)}/мес` : ''}
              </span>
            )
          })}
        </div>
      )}

      {nextDate && !adding && (
        <p className="muted small" style={{ margin: 0 }}>
          {nextDate <= todayISO() ? 'Пора сделать новый замер.' : `Следующий замер — примерно ${formatDay(nextDate)}.`}
        </p>
      )}

      {adding ? (
        <div className="stack measure-form" style={{ gap: 10 }}>
          <label className="row between">
            <span>Дата</span>
            <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value || todayISO() })} />
          </label>
          <div className="measure-inputs">
            {MEASURES.map(({ key, label }) => (
              <label key={key} className="stack" style={{ gap: 4 }}>
                <span className="small muted">{label}, см</span>
                <input className="input" inputMode="decimal" placeholder="—" value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={save}>
              Сохранить замер
            </button>
            {list.length > 0 && (
              <button className="btn sm ghost" onClick={() => setAdding(false)}>
                Отмена
              </button>
            )}
          </div>
          {list.length === 0 && <p className="muted small" style={{ margin: 0 }}>Первый замер станет точкой старта. Её можно поменять кнопкой в таблице.</p>}
        </div>
      ) : (
        <button className="btn block sm" onClick={() => setAdding(true)}>
          + Новый замер
        </button>
      )}

      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setHow(!how)}>
        {how ? 'Свернуть' : 'Как правильно мерить'}
      </button>
      {how && (
        <div className="stack small" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}>
            <b>Общее:</b> раз в месяц, утром натощак, после туалета, до тренировки. Мягкая сантиметровая лента прилегает, но не врезается. Каждый обхват
            — 2 раза, записывай среднее. Лучше в одни и те же дни цикла: вода может добавить 1–2 см на талии и бёдрах.
          </p>
          {MEASURES.map((m) => (
            <p key={m.key} style={{ margin: 0 }}>
              <b>{m.label}:</b> {m.how}
            </p>
          ))}
        </div>
      )}
    </Section>
  )
}

/** Половина ширины силуэта для разных уровней; прирост в см утрирован ×4, чтобы было видно */
const K = 4
type Widths = { chest: number; waist: number; hips: number }

const outline = ({ chest, waist, hips }: Widths) => {
  // Правая половина силуэта сверху вниз (x от центра), потом зеркально левая
  const pts: [number, number][] = [
    [11, 0],
    [13, 12],
    [38, 19],
    [58, 28],
    [chest + 3, 50],
    [chest, 82],
    [waist, 150],
    [hips, 212],
    [hips - 4, 258],
    [hips - 12, 300],
    [6, 300],
    [3, 238],
  ]
  const toX = (x: number, side: 1 | -1) => 100 + side * x
  const right = pts.map(([x, y]) => [toX(x, 1), y] as [number, number])
  const left = [...pts].reverse().map(([x, y]) => [toX(x, -1), y] as [number, number])
  const all = [...right, ...left]
  // Сглаживание: Catmull-Rom → кривые Безье
  let d = `M${all[0][0]},${all[0][1]}`
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[i - 1] ?? all[i]
    const p1 = all[i]
    const p2 = all[i + 1]
    const p3 = all[i + 2] ?? p2
    // Разрез между ногами и линия плеч — прямые
    const straight = (p1[1] === 300 && p2[1] === 300) || (p1[1] === 0 && p2[1] === 0)
    if (straight) {
      d += ` L${p2[0]},${p2[1]}`
      continue
    }
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + ' Z'
}

const ARM =
  'M152,24 C168,25 176,40 176,60 C178,98 181,138 183,178 C185,204 189,222 187,236 C185,245 172,245 170,236 C168,222 168,204 166,182 C163,150 160,118 156,96 C154,80 152,60 150,40 Z'

function BodyFigure({ stats }: { stats: ReturnType<typeof measureStats>['stats'] }) {
  const base: Widths = { chest: 52, waist: 40, hips: 58 }
  const clamp = (v: number) => Math.max(-14, Math.min(14, v))
  const now: Widths = {
    chest: base.chest + clamp((stats.chest?.delta ?? 0) * K),
    waist: base.waist + clamp((stats.waist?.delta ?? 0) * K),
    hips: base.hips + clamp((stats.hips?.delta ?? 0) * K),
  }
  const rows: { key: MeasureKey; y: number; label: string }[] = [
    { key: 'chest', y: 80, label: 'грудь' },
    { key: 'waist', y: 150, label: 'талия' },
    { key: 'hips', y: 212, label: 'бёдра' },
  ]
  return (
    <svg className="body-figure" viewBox="-45 0 290 310" role="img" aria-label="Изменение обхватов от стартового замера">
      <defs>
        <linearGradient id="bf-skin" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d9d4cf" />
          <stop offset="1" stopColor="#b9b3ad" />
        </linearGradient>
      </defs>
      {/* Руки опущены вдоль тела, за силуэтом */}
      {[1, -1].map((side) => (
        <path
          key={side}
          d={ARM}
          transform={side < 0 ? 'matrix(-1 0 0 1 200 0)' : undefined}
          fill="url(#bf-skin)"
          opacity="0.5"
        />
      ))}
      <path d={outline(base)} fill="url(#bf-skin)" opacity="0.55" />
      {/* Белая майка и тёмные легинсы, как у девушки на анимациях */}
      <clipPath id="bf-clip">
        <path d={outline(base)} />
      </clipPath>
      <g clipPath="url(#bf-clip)">
        <rect x="0" y="34" width="200" height="146" fill="#f4f4f2" opacity="0.8" />
        <rect x="0" y="178" width="200" height="140" fill="#3a3a3c" opacity="0.85" />
      </g>
      {/* Разница между стартом и сейчас: снаружи тела — прибавка, внутри — убавка */}
      <path d={`${outline(now)} ${outline(base)}`} fillRule="evenodd" fill="rgba(198,244,50,0.45)" />
      <path d={outline(now)} fill="none" stroke="#c6f432" strokeWidth="1.4" strokeDasharray="4 3" />
      {rows.map(({ key, y, label }) => {
        const st = stats[key]
        const w = now[key]
        return (
          <g key={key}>
            <line x1={100 - w} x2={100 + w} y1={y} y2={y} stroke="#c6f432" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.8" />
            <text x={196} y={y + 4} fontSize="11" fill="#f2f2f2" fontFamily="Outfit, sans-serif">
              {st ? `${fmtDelta(st.delta)} см` : '—'}
            </text>
            <text x={4} y={y + 4} fontSize="10" fill="rgba(255,255,255,.55)" textAnchor="end" fontFamily="Outfit, sans-serif">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
