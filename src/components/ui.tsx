import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'

/** Запоминаем прокрутку в записи истории, чтобы «Назад» вернул туда, откуда ушли */
const saveScroll = () => {
  try {
    history.replaceState({ ...(history.state ?? {}), y: window.scrollY }, '')
  } catch {
    // в некоторых окнах история недоступна — тогда просто начинаем сверху
  }
}

export const navigate = (hash: string) => {
  saveScroll()
  window.location.hash = hash
}

/** Переход на соседний день или месяц: без новой записи в истории и без прыжка наверх */
let keepScroll = false
export const switchTo = (hash: string) => {
  keepScroll = true
  history.replaceState(history.state, '', `#${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Горизонтальный свайп пальцем: влево — дальше, вправо — назад */
export const useSwipe = (onLeft: () => void, onRight: () => void) => {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.changedTouches[0].clientX - s.x
      const dy = e.changedTouches[0].clientY - s.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? onLeft : onRight)()
    },
  }
}

const restoreScroll = () => {
  const y = (history.state as { y?: number } | null)?.y ?? 0
  // Экран дорисовывается не сразу (анимации, картинки), поэтому догоняем прокрутку несколько раз
  let tries = 0
  const go = () => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) > 2 && ++tries < 10) setTimeout(go, 60)
  }
  requestAnimationFrame(go)
}

export const useRoute = () => {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    let t: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(t)
      t = setTimeout(saveScroll, 250)
    }
    const on = () => {
      clearTimeout(t)
      setHash(window.location.hash.slice(1) || '/')
      if (keepScroll) keepScroll = false
      else restoreScroll()
    }
    window.addEventListener('hashchange', on)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('hashchange', on)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return hash.split('/').filter(Boolean)
}

export const fmtKg = (w: number) => `${String(w).replace('.', ',')}`

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  over,
}: {
  over?: boolean
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)))
  return (
    <span className={`stepper ${over ? 'over' : ''}`}>
      <button type="button" aria-label="Меньше" onClick={() => set(value - step)}>
        −
      </button>
      <span className="val">
        {fmtKg(value)}
        {unit && <span className="unit">{unit}</span>}
      </span>
      <button type="button" aria-label="Больше" onClick={() => set(value + step)}>
        +
      </button>
    </span>
  )
}

export function Back({ to = '/' }: { to?: string }) {
  return (
    <button className="link back" onClick={() => (history.length > 1 ? history.back() : navigate(to))}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Назад
    </button>
  )
}

export function Section({ eyebrow, title, children, action }: { eyebrow?: string; title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="glass card stack fade-in">
      {(eyebrow || title || action) && (
        <div className="row between">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2 className="title">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const pluralRu = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
