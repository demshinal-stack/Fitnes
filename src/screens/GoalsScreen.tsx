import { useState } from 'react'
import { Section, Stepper, fmtKg, navigate } from '../components/ui'
import { Thumb } from '../components/Thumb'
import { exerciseById, isAvailable } from '../data/machines'
import { GOAL_PRESETS, presetById } from '../data/lifeGoals'
import { addDays, formatDay, todayISO } from '../lib/date'
import { useStore } from '../store'
import type { AppState, LifeGoal } from '../types'
import { GOAL_MODELS, type GoalModel } from '../data/goalModels'
import { effectAfter, etaDate, goalRate, goalSessions, programEndOf, strengthGain } from '../lib/goalProgress'
import { weekIndex } from '../lib/plan'

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
  const model = goal.preset ? GOAL_MODELS[goal.preset] : undefined
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

      {model && <Tracker goal={goal} model={model} exercises={exercises} save={save} />}

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

const fmtN = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const signed = (m: GoalModel, v: number) => `${m.sign > 0 ? '+' : '−'}${fmtN(Math.abs(v))}${m.unit === '°' ? '°' : ` ${m.unit}`}`

/** Трекер цели: что скорее всего уже есть по выполненным тренировкам и когда будет цель */
function Tracker({ goal, model: m, exercises, save }: { goal: LifeGoal; model: GoalModel; exercises: string[]; save: (p: Partial<LifeGoal>) => void }) {
  const { state } = useStore()
  const [why, setWhy] = useState(false)
  const target = goal.target ?? m.defaultTarget
  const boosted = !!goal.boosted && !!m.boost
  const n = goalSessions(state, exercises)
  const rate = goalRate(state, exercises)
  const now = effectAfter(m, n, boosted)
  const pct = Math.min(100, Math.round((now / target) * 100))
  const eta = etaDate(m, target, boosted, n, rate)
  const end = programEndOf(state)
  const p = state.profile!
  const endN = end ? n + Math.max(0, weekIndex(end, todayISO())) * rate : n
  const months = [1, 3, 6, 12].map((mo) => ({ mo, v: effectAfter(m, rate * mo * 4.35, boosted) }))
  const ceiling = m.max * (boosted && m.boost ? m.boost : 1)
  const strength = strengthGain(state, exercises)

  return (
    <div className="tracker stack" style={{ gap: 10 }}>
      <div className="tracker-now">
        <div>
          <div className="eyebrow">Скорее всего уже</div>
          <div className="tracker-big">{signed(m, now)}</div>
          <div className="muted small">
            {m.metric} · {n} {plural(n, 'тренировка', 'тренировки', 'тренировок')} на эту цель
          </div>
        </div>
        <div className="tracker-goal">
          <div className="eyebrow">Цель</div>
          <Stepper
            value={target}
            step={m.step}
            min={m.step}
            max={Math.floor(ceiling * 0.95 / m.step) * m.step}
            unit={m.unit}
            onChange={(v) => save({ target: v })}
          />
        </div>
      </div>
      <div className="progress tracker-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="small">
        {pct >= 100 ? (
          <b className="lime-text">Судя по тренировкам, цель уже должна быть достигнута — проверь замером!</b>
        ) : eta ? (
          <>
            При твоём графике ({fmtN(rate)} {plural(Math.round(rate), 'тренировка', 'тренировки', 'тренировок')} в неделю на эту цель) — примерно{' '}
            <b className="lime-text">к {formatDay(eta)}{eta.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${eta.slice(0, 4)}` : ''}</b>.
          </>
        ) : (
          <>Такую цель за первый год только тренировками не набрать: реалистичный потолок около {signed(m, ceiling * 0.9)}.</>
        )}
        {end && endN > n && <> К концу программы ({formatDay(end)}) — около {signed(m, effectAfter(m, endN, boosted))}.</>}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {months.map(({ mo, v }) => (
          <span key={mo} className="chip">
            {mo} мес: {signed(m, v)}
          </span>
        ))}
      </div>
      {m.boost && (
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={boosted} onChange={(e) => save({ boosted: e.target.checked })} />
          <span className="small">{m.boostLabel} (прогноз ×{fmtN(m.boost)})</span>
        </label>
      )}
      {strength !== undefined && (
        <div className="small">
          По твоим записям рабочие веса в упражнениях цели выросли на <b className="lime-text">{Math.round(strength * 100)}%</b>.
        </div>
      )}
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setWhy(!why)}>
        {why ? 'Свернуть' : 'Откуда цифры и как мерить'}
      </button>
      {why && (
        <div className="stack small" style={{ gap: 6 }}>
          <p style={{ margin: 0 }}>{m.evidence}</p>
          <p style={{ margin: 0 }}>
            <b>Как мерить:</b> {m.howToMeasure}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Это среднее по исследованиям, у каждого по-своему: разброс примерно в 2 раза. Прогноз считает только тренировки, где были упражнения
            этой цели, и учитывает, что первые месяцы дают больше всего. Профиль: {p.trainingDays.length} {plural(p.trainingDays.length, 'день', 'дня', 'дней')} в неделю.
          </p>
          {m.sources.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="link">
              {src.title} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  if (b >= 2 && b <= 4) return few
  return many
}
