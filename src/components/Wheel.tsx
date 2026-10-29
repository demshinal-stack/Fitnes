import { useEffect, useRef } from 'react'

const ITEM = 44

/** Вертикальный барабан выбора числа, как в iOS: листаешь и останавливаешь на нужном значении */
export function Wheel({
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)
  const count = Math.round((max - min) / step) + 1
  const indexOf = (v: number) => Math.min(count - 1, Math.max(0, Math.round((v - min) / step)))
  const valueAt = (i: number) => Math.round((min + i * step) * 100) / 100

  useEffect(() => {
    const el = box.current
    if (el && Math.round(el.scrollTop / ITEM) !== indexOf(value)) el.scrollTop = indexOf(value) * ITEM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = box.current
      if (!el) return
      const v = valueAt(Math.round(el.scrollTop / ITEM))
      if (v !== value) onChange(v)
    }, 90)
  }

  const nudge = (d: number) => {
    const v = valueAt(indexOf(value) + d)
    if (v >= min && v <= max) onChange(v)
  }

  return (
    <div
      className="wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') nudge(-1)
        if (e.key === 'ArrowDown') nudge(1)
      }}
    >
      <div className="wheel-band" aria-hidden />
      <div className="wheel-list" ref={box} onScroll={onScroll}>
        <div style={{ height: ITEM * 2 }} />
        {Array.from({ length: count }, (_, i) => {
          const v = valueAt(i)
          return (
            <button key={i} type="button" tabIndex={-1} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
              {format(v)}
            </button>
          )
        })}
        <div style={{ height: ITEM * 2 }} />
      </div>
    </div>
  )
}
