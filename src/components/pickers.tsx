import { useEffect, useRef } from 'react'
import { fmtKg } from './ui'

/** Ряд отверстий регулировки: тап выбирает отверстие, рекомендованное обведено розовым */
export function HolePicker({
  count,
  value,
  suggested,
  onChange,
  label,
  ends,
}: {
  ends?: [string, string]
  count: number
  value: number
  suggested: number
  onChange: (v: number) => void
  label: string
}) {
  const holes = (
    <div className="holes" role="radiogroup" aria-label={label}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          className={`hole ${n === value ? 'on' : ''} ${n === suggested ? 'rec' : ''}`}
          onClick={() => onChange(n)}
        >
          <span className="pin" />
          <span className="num">{n}</span>
        </button>
      ))}
    </div>
  )
  if (!ends) return holes
  return (
    <div className="stack" style={{ gap: 6 }}>
      {holes}
      <div className="hole-ends">
        <span>
          <b>1</b> · {ends[0]}
        </span>
        <span>
          {ends[1]} · <b>{count}</b>
        </span>
      </div>
    </div>
  )
}

/**
 * Грузовой стек: плиты сверху вниз от лёгкой к тяжёлой, как на тренажёре.
 * Тап по плите — переставить штифт. Плиты над штифтом поднимаются (розовые).
 */
export function WeightStack({
  weights,
  value,
  recommended,
  onChange,
}: {
  weights: number[]
  value: number
  recommended: number
  onChange: (v: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('.plate.on')
    if (el && box.current) box.current.scrollTop = el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2
  }, [value])
  return (
    <div className="stack-box" ref={box} role="radiogroup" aria-label="Вес на стеке">
      {weights.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={w === value}
          className={`plate ${w <= value ? 'lifted' : ''} ${w === value ? 'on' : ''}`}
          onClick={() => onChange(w)}
        >
          <span className="kg">{fmtKg(w)}</span>
          {w === value && <span className="pin" aria-hidden />}
          {w === recommended && <span className="rec-tag rec">рекомендовано</span>}
          {w === value && w !== recommended && <span className="rec-tag sel">выбрано</span>}
        </button>
      ))}
    </div>
  )
}
