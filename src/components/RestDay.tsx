import { useState } from 'react'
import { EXERCISES } from '../data/machines'
import { formatDayLong, todayISO, weekday } from '../lib/date'
import { plannedDay } from '../lib/plan'
import { reducer, useStore } from '../store'
import { Thumb } from './Thumb'
import { navigate } from './ui'

/** Милые подписи дня отдыха: на каждую дату своя, но всегда одна и та же */
const REST_LINES = [
  'мышцы растут, пока ты отдыхаешь',
  'сегодня можно просто быть красивой',
  'отдых — тоже часть тренировки',
  'выспись, попей водички и улыбнись',
  'погуляй, потянись и побалуй себя',
]
const lineFor = (date: string) => REST_LINES[Number(date.replaceAll('-', '')) % REST_LINES.length]

/** День без тренировки: «сегодня отдых» и кнопка, чтобы записать тренировку (A/B или свои упражнения) */
export function RestDay({ date, onDone }: { date: string; onDone?: () => void }) {
  const { state, dispatch } = useStore()
  const p = state.profile!
  const today = todayISO()
  const [mode, setMode] = useState<'rest' | 'pick' | 'free'>('rest')
  const [chosen, setChosen] = useState<string[]>([])

  const title = date === today ? 'Сегодня отдых' : date < today ? 'Был день отдыха' : 'День отдыха'

  const open = () => {
    onDone?.()
    navigate(`/day/${date}`)
  }
  const pickTemplate = (id: string) => {
    const scheduled = date >= p.startDate && p.trainingDays.includes(weekday(date))
    const on = { type: 'dayOverride' as const, date, on: scheduled ? null : true }
    dispatch(on)
    // Тренировку по чередованию не переопределяем, иначе ставим выбранную на этот день
    if (plannedDay(reducer(state, on), date)?.template.id !== id) dispatch({ type: 'templateFor', date, templateId: id })
    open()
  }
  const pickFree = () => {
    dispatch({ type: 'freeDay', date, exerciseIds: chosen })
    open()
  }

  return (
    <div className="rest-day stack">
      <div className="rest-hero">
        <svg className="rest-art" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 54C18 44 9 35 9 24.5 9 17.6 14.3 12 21 12c4.6 0 8.6 2.6 11 6.4C34.4 14.6 38.4 12 43 12c6.7 0 12 5.6 12 12.5C55 35 46 44 32 54z" />
        </svg>
        <div className="eyebrow">{formatDayLong(date)}</div>
        <h2 className="title rest-title">{title}</h2>
        <p className="rest-line">{lineFor(date)}</p>
      </div>

      {mode === 'rest' && (
        <button className="btn block" onClick={() => setMode('pick')}>
          Записать тренировку
        </button>
      )}

      {mode === 'pick' && (
        <div className="stack" style={{ gap: 8 }}>
          {state.templates.map((t) => (
            <button key={t.id} className="rest-choice" onClick={() => pickTemplate(t.id)}>
              <span className="rest-choice-name">{t.name}</span>
              {t.tagline && <span className="muted small">{t.tagline}</span>}
            </button>
          ))}
          <button className="rest-choice" onClick={() => setMode('free')}>
            <span className="rest-choice-name">Выбрать упражнения</span>
            <span className="muted small">только то, что хочется</span>
          </button>
          <button className="link small" style={{ alignSelf: 'center' }} onClick={() => setMode('rest')}>
            Нет, отдыхаю
          </button>
        </div>
      )}

      {mode === 'free' && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="rest-list">
            {EXERCISES.map((e) => {
              const on = chosen.includes(e.id)
              return (
                <button
                  key={e.id}
                  className={`ex-row ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setChosen(on ? chosen.filter((id) => id !== e.id) : [...chosen, e.id])}
                >
                  <Thumb className="thumb" exerciseId={e.id} />
                  <span className="title" style={{ flex: 1, textAlign: 'left', fontSize: 15 }}>
                    {e.name}
                  </span>
                  <span className={`rest-check ${on ? 'on' : ''}`}>{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          <button className="btn block" disabled={chosen.length === 0} onClick={pickFree}>
            {chosen.length ? `Записать · ${chosen.length}` : 'Отметь упражнения'}
          </button>
          <button className="link small" style={{ alignSelf: 'center' }} onClick={() => setMode('pick')}>
            ‹ К тренировкам
          </button>
        </div>
      )}
    </div>
  )
}
