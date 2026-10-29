import { useEffect, useState } from 'react'

export const SLOGAN = 'за гранью возможностей'

type Line = { d: string; color: string; w: number; delay: number; dash?: string }

const BLUE = '#c6f432'
const PINK = '#ff8fb8'
const WINE = '#7f9c1c'
// Разные линии через экран (viewBox 100×200): волны, дуги, пунктир, спираль, тонкие штрихи
const LINES: Line[] = [
  // длинная волна сверху
  { d: 'M-10 26 C 15 8, 35 44, 55 24 S 90 6, 110 30', color: BLUE, w: 1.4, delay: 0 },
  // тонкая пунктирная параллель
  { d: 'M-10 34 C 15 16, 35 52, 55 32 S 90 14, 110 38', color: PINK, w: 0.5, delay: 0.15, dash: '0.012 0.018' },
  // дуги-орбиты в правом верхнем углу
  { d: 'M68 -4 A 40 40 0 0 0 112 58', color: PINK, w: 0.8, delay: 0.3 },
  { d: 'M78 -4 A 30 30 0 0 0 112 44', color: WINE, w: 1.6, delay: 0.4 },
  // спиралька слева посередине
  { d: 'M-4 92 C 10 80, 22 92, 16 102 C 10 112, -2 104, 4 96', color: BLUE, w: 0.7, delay: 0.5 },
  // диагональные штрихи-«скорость»
  { d: 'M70 104 L 96 92', color: PINK, w: 0.9, delay: 0.6 },
  { d: 'M76 112 L 108 97', color: BLUE, w: 0.5, delay: 0.65 },
  { d: 'M82 120 L 100 112', color: WINE, w: 1.2, delay: 0.7 },
  // широкая петля снизу
  { d: 'M-10 170 C 20 140, 45 200, 60 168 C 70 146, 40 140, 50 160 S 90 190, 110 160', color: PINK, w: 1.1, delay: 0.8 },
  // бордовая волна у самого низа
  { d: 'M-10 190 Q 15 178, 30 190 T 70 190 T 110 188', color: WINE, w: 1.8, delay: 0.95 },
  // дуга слева снизу
  { d: 'M-6 120 A 34 34 0 0 1 24 156', color: BLUE, w: 1, delay: 1, dash: '0.04 0.03' },
]
const DOTS = [
  [12, 62, BLUE],
  [88, 70, PINK],
  [30, 128, WINE],
  [92, 146, BLUE],
  [58, 82, PINK],
] as const

/** Мягкие светящиеся линии: на фоне приложения и в заставке (там они прорисовываются) */
function GlowLines({ draw = false }: { draw?: boolean }) {
  return (
    <svg className={`glow-lines ${draw ? 'draw' : ''}`} viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {LINES.map((l, n) => (
        <path
          key={n}
          d={l.d}
          pathLength={1}
          fill="none"
          stroke={l.color}
          strokeWidth={l.w}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          filter="url(#line-glow)"
          strokeDasharray={l.dash}
          className={l.dash ? 'dashed' : undefined}
          style={{ animationDelay: `${l.delay}s` }}
        />
      ))}
      {DOTS.map(([x, y, c], n) => (
        <circle key={n} className="dot" cx={x} cy={y} r={0.9} fill={c} filter="url(#line-glow)" style={{ animationDelay: `${0.6 + n * 0.15}s` }} />
      ))}
    </svg>
  )
}

/** Светящиеся линии на заднем плане всего приложения */
export function ConfettiBackground() {
  return (
    <div className="confetti-bg" aria-hidden="true">
      <GlowLines />
    </div>
  )
}

/** Логотип как на вывеске: строчное «jaylle» с наклонной «y», под ним справа — fitness */
export function Brand({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <div className={`logo logo-${size} ${className ?? ''}`} aria-label="Jaylle fitness">
      <span className="logo-word">
        ja<i>y</i>lle
      </span>
      <span className="logo-fit">fitness</span>
    </div>
  )
}

/** Заставка при открытии: прорисовываются светящиеся линии, появляются логотип и слоган курсивом. Тап — пропустить */
export function Splash() {
  const [phase, setPhase] = useState<'show' | 'hide' | 'gone'>('show')
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setPhase('hide'), reduce ? 900 : 3000)
    const t2 = setTimeout(() => setPhase('gone'), reduce ? 1300 : 3600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])
  if (phase === 'gone') return null
  return (
    <div className={`splash ${phase === 'hide' ? 'out' : ''}`} onClick={() => setPhase('hide')} role="presentation">
      <GlowLines draw />
      <div className="splash-logo">
        <Brand size="lg" className="splash-brand" />
        <div className="splash-slogan">{SLOGAN}</div>
      </div>
    </div>
  )
}
