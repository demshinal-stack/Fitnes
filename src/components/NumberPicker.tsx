import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wheel } from './Wheel'

/** Соседние «популярные» значения: кратные quick, ближайшие слева и справа от выбранного */
export const quickNeighbors = (value: number, quick: number, step: number, min: number, max: number) => {
  let left = Math.ceil(value / quick) * quick - quick
  if (left < min) left = value - step >= min ? value - step : NaN
  let right = Math.floor(value / quick) * quick + quick
  if (right > max) right = NaN
  return { left, right }
}

/**
 * Выбор числа: слева и справа серые быстрые кнопки, в центре выбранное,
 * справа кнопка-список, раскрывающая прокручиваемый список значений.
 */
export function NumberPicker({
  value,
  onChange,
  quick = 5,
  step = 1,
  min = 1,
  max = 100,
  label,
  compact = false,
}: {
  value: number
  onChange: (v: number) => void
  quick?: number
  step?: number
  min?: number
  max?: number
  label: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { left, right } = quickNeighbors(value, quick, step, min, max)
  return (
    <div className={`npick ${compact ? 'compact' : ''}`} role="group" aria-label={label}>
      <button type="button" className="q" disabled={Number.isNaN(left)} onClick={() => onChange(left)} aria-label={`${label}: ${left}`}>
        {Number.isNaN(left) ? '' : left}
      </button>
      <span className="cur" aria-live="polite">
        {value}
      </span>
      <button type="button" className="q" disabled={Number.isNaN(right)} onClick={() => onChange(right)} aria-label={`${label}: ${right}`}>
        {Number.isNaN(right) ? '' : right}
      </button>
      <button type="button" className="more" onClick={() => setOpen(true)} aria-label={`${label}: выбрать из списка`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h10M4 12h10M4 17h6M18 9l2-2.5L22 9M18 15l2 2.5 2-2.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <NumberSheet
            label={label}
            value={value}
            step={step}
            min={min}
            max={max}
            onClose={() => setOpen(false)}
            onPick={(v) => {
              onChange(v)
              setOpen(false)
            }}
          />,
          document.body,
        )}
    </div>
  )
}

function NumberSheet({
  label,
  value,
  step,
  min,
  max,
  onPick,
  onClose,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  onPick: (v: number) => void
  onClose: () => void
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div className="title">{label}</div>
          <button className="link" onClick={() => onPick(v)}>
            Готово
          </button>
        </div>
        <Wheel label={label} value={v} min={Math.ceil(min / step) * step} max={max} step={step} onChange={setV} />
      </div>
    </div>
  )
}
