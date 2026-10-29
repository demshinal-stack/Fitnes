import { useState } from 'react'
import { Section, Stepper, fmtKg, navigate } from '../components/ui'
import { Thumb } from '../components/Thumb'
import { exerciseById, isAvailable } from '../data/machines'
import { GOAL_PRESETS, presetById } from '../data/lifeGoals'
import { addDays, formatDay, todayISO } from '../lib/date'
import { useStore } from '../store'
import type { AppState, LifeGoal } from '../types'

/** Сделанные подходы по упражнениям цели за последние 30 дней и тренировки с момента постановки цели */
const progressOf = (state: AppState, goal: LifeGoal, exercises: string[]) => {
  const from = addDays(todayISO(), -30)
  let sets = 0
  let workouts = 0
  for (const [date, log] of Object.entries(state.logs)) {
    if (log.completed && date >= goal.createdAt) workouts++
    if (date < from) continue
    for (const id of exercises) sets += (log.exercises[id] ?? []).filter((s) => s.done).length
  }
  return { sets, workouts }
}

export function GoalsScreen() {
  const { state, dispatch } = useStore()
  const goals = state.lifeGoals ?? []
  const [custom, setCustom] = useState('')
  const free = GOAL_PRESETS.filter((p) => !goals.some((g) => g.preset === p.id))

  const add = (title: string, preset?: string) =>
    dispatch({ type: 'lifeGoal', goal: { id: `${preset ?? 'own'}-${Date.now()}`, title, preset, createdAt: todayISO() } })

  return (
    <div className="stack">
      <header className="header fade-in">
        <div className="eyebrow">Маленькие шаги · Сильные привычки</div>
        <h1 className="display">
          Цели
          <br />
          <em>на будущее.</em>
        </h1>
      </header>

      {goals.length === 0 && (
        <section className="glass card fade-in muted desc">
          Целей пока нет. Выбери ниже, к чему идёшь, или напиши свою: приложение покажет, какие упражнения программы на неё работают.
        </section>
      )}

      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} />
      ))}

      <FocusList goals={goals.filter((g) => !g.done)} />

      <Section eyebrow="Новая цель" title="К чему идём">
        <div className="row wrap" style={{ gap: 8 }}>
          {free.map((p) => (
            <button key={p.id} className="chip rose" onClick={() => add(p.title, p.id)}>
              + {p.title}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Своя цель, например «пробежать 5 км»"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn sm"
            disabled={!custom.trim()}
            onClick={() => {
              add(custom.trim())
              setCustom('')
            }}
          >
            Добавить
          </button>
        </div>
      </Section>
    </div>
  )
}

/** Общий набор упражнений под все цели: чем больше целей закрывает упражнение, тем выше оно в списке и тем больше «×N» */
function FocusList({ goals }: { goals: LifeGoal[] }) {
  const { state } = useStore()
  const inProgram = new Set(state.templates.flatMap((t) => t.exerciseIds))
  const map = new Map<string, LifeGoal[]>()
  for (const g of goals) for (const id of (presetById(g.preset)?.exercises ?? []).filter(isAvailable)) map.set(id, [...(map.get(id) ?? []), g])
  const rows = [...map.entries()].sort((x, y) => y[1].length - x[1].length || Number(inProgram.has(y[0])) - Number(inProgram.has(x[0])))
  if (rows.length === 0) return null
  return (
    <Section eyebrow="Под мои цели" title="Чем заниматься">
      <p className="muted desc" style={{ margin: 0 }}>
        «×2», «×3» — упражнение работает сразу на несколько целей. Им стоит уделять больше внимания.
      </p>
      {rows.map(([id, gs]) => (
        <button key={id} className="ex-row focus-row" onClick={() => navigate(`/ex/${id}`)}>
          <Thumb className="thumb" exerciseId={id} />
          <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <span className="title" style={{ fontSize: 15, display: 'block' }}>
              {exerciseById(id).name}
            </span>
            <span className="muted small">{gs.map((g) => g.title).join(' · ')}</span>
            {!inProgram.has(id) && <span className="small" style={{ display: 'block', color: 'var(--electric)', fontWeight: 800 }}>можно добавить в программу</span>}
          </span>
          {gs.length > 1 && <span className="times">×{gs.length}</span>}
        </button>
      ))}
    </Section>
  )
}

function GoalCard({ goal }: { goal: LifeGoal }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const preset = presetById(goal.preset)
  const inProgram = new Set(state.templates.flatMap((t) => t.exerciseIds))
  const exercises = (preset?.exercises ?? []).filter(isAvailable).sort((a, b) => Number(inProgram.has(b)) - Number(inProgram.has(a)))
  const { sets, workouts } = progressOf(state, goal, exercises)
  const save = (patch: Partial<LifeGoal>) => dispatch({ type: 'lifeGoal', goal: { ...goal, ...patch } })
  const p = state.profile!
  const bw = goal.targetBodyWeight

  return (
    <section className={`glass card stack fade-in ${goal.done ? 'goal-done' : ''}`}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">с {formatDay(goal.createdAt)}{goal.targetDate ? ` · к ${formatDay(goal.targetDate)}` : ''}</div>
          <h2 className="title" style={{ fontSize: 22 }}>
            {goal.title}
          </h2>
        </div>
        <button className={`chip ${goal.done ? 'wine' : ''}`} onClick={() => save({ done: !goal.done })}>
          {goal.done ? 'Достигнута ✓' : 'Отметить'}
        </button>
      </div>

      {preset && <p className="muted desc" style={{ margin: 0 }}>{preset.tip}</p>}

      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip">{workouts} тренировок с начала цели</span>
        {exercises.length > 0 && <span className="chip blue">{sets} подходов за 30 дней</span>}
        {preset?.bodyWeight && bw !== undefined && (
          <span className="chip rose">
            {fmtKg(p.weightKg)} → {fmtKg(bw)} кг
          </span>
        )}
      </div>

      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(!open)}>
        {open ? 'Свернуть' : 'Срок и детали'}
      </button>
      {open && (
        <div className="stack" style={{ gap: 10 }}>
          <label className="row between">
            <span>К какой дате</span>
            <input className="input" type="date" value={goal.targetDate ?? ''} onChange={(e) => save({ targetDate: e.target.value || undefined })} />
          </label>
          {preset?.bodyWeight && (
            <div className="row between">
              <span>Желаемый вес</span>
              <Stepper value={bw ?? Math.round(p.weightKg - 3)} step={0.5} min={35} max={200} unit="кг" onChange={(v) => save({ targetBodyWeight: v })} />
            </div>
          )}
          <textarea
            className="input"
            rows={2}
            placeholder="Заметка: зачем мне это, как пойму, что получилось"
            value={goal.note ?? ''}
            onChange={(e) => save({ note: e.target.value || undefined })}
          />
          <button className="link" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }} onClick={() => dispatch({ type: 'removeLifeGoal', id: goal.id })}>
            Удалить цель
          </button>
        </div>
      )}
      {!open && goal.note && <p className="muted desc" style={{ margin: 0 }}>{goal.note}</p>}
    </section>
  )
}
