import { useEffect, useMemo, useRef, useState } from 'react'
import { Brand } from '../components/Brand'
import { exerciseById, machineById } from '../data/machines'
import { addDays, formatDayLong, todayISO, weekday } from '../lib/date'
import { copiedSets, growth, recommendedPlan, stepFor, plannedDay, plannedDays, previousPlan, programEnd, settingsFor, stackWeights, weekIndex } from '../lib/plan'
import { useStore } from '../store'
import type { AppState, PlannedExercise, SetLog } from '../types'
import { Back, CheckIcon, Stepper, fmtKg, navigate, switchTo } from '../components/ui'
import { Thumb } from '../components/Thumb'
import { NumberPicker } from '../components/NumberPicker'

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const shortDate = (iso: string) => `${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}`

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
}

/** Сеты дня: записанные или по плану */
const setsOf = (state: AppState, date: string, pe: PlannedExercise): SetLog[] =>
  state.logs[date]?.exercises[pe.exerciseId] ??
  copiedSets(state, date, pe.exerciseId) ??
  Array.from({ length: pe.sets }, () => ({ weight: pe.weight, reps: pe.reps, done: false }))

export function DayScreen({ date: requested }: { date?: string }) {
  const { state, dispatch } = useStore()
  const p = state.profile!
  const today = todayISO()
  // С самой ранней отмеченной тренировки, чтобы по ленте дней можно было листать и прошлые
  const all = useMemo(() => plannedDays(state, '0000-01-01', programEnd(p)), [state, p])
  // Без даты показываем сегодняшнюю тренировку, а если сегодня отдых — ближайшую
  const date = requested ?? (all.find((d) => d.date >= today) ?? all[all.length - 1])?.date ?? today
  const idx = all.findIndex((d) => d.date === date)
  const day = idx >= 0 ? all[idx] : plannedDay(state, date)
  const log = state.logs[date]
  // Режим порядка переживает переход к описанию упражнения и «Назад»
  const [ordering, setOrderingState] = useState(() => {
    try {
      return sessionStorage.getItem(ORDER_KEY) === date
    } catch {
      return false
    }
  })
  const setOrdering = (on: boolean) => {
    setOrderingState(on)
    try {
      if (on) sessionStorage.setItem(ORDER_KEY, date)
      else sessionStorage.removeItem(ORDER_KEY)
    } catch {
      /* приватный режим */
    }
  }
  // Направление последнего перелистывания: от него зависит, с какой стороны въезжает новый день
  const [dir, setDir] = useState<'l' | 'r' | ''>('')
  const prevDay = all[idx - 1]
  const nextDay = all[idx + 1]
  const go = (d: string | undefined, to: 'l' | 'r') => {
    if (!d) return
    setDir(to)
    setOrdering(false)
    switchTo(`/day/${d}`)
  }
  // Лента дней листается сама по себе (пальцем), выбранный день держим по центру
  const stripRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const box = stripRef.current
    const el = box?.querySelector<HTMLElement>(`[data-date="${date}"]`)
    if (!box || !el) return
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [date])

  if (!day)
    return (
      <div className="stack">
        <Back />
        <h1 className="display">День отдыха</h1>
        <p className="muted">На {formatDayLong(date)} тренировок не запланировано.</p>
      </div>
    )

  const completed = !!log?.completed
  const allSets = day.exercises.flatMap((pe) => setsOf(state, date, pe))
  const done = allSets.filter((x) => x.done).length
  const pct = allSets.length ? Math.round((done / allSets.length) * 100) : 0
  const minutes = Math.round((allSets.length * 2 + 5) / 5) * 5
  const areas = [...new Set(day.exercises.map((e) => exerciseById(e.exerciseId).area))]
  const muscles = areas.length > 1 ? `${areas.slice(0, -1).join(', ')} и ${areas[areas.length - 1]}` : areas[0]
  const totalWeeks = weekIndex(addDays(programEnd(p), -1), p.startDate) + 1

  return (
    <div className="stack">
      <header className="header fade-in" style={{ marginBottom: 6 }}>
        <div className="row between">
          <Brand />
          {requested && <Back />}
        </div>
        <div>
          <div className="title" style={{ textTransform: 'none', fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 24 }}>
            {greeting()}
            {p.name ? `, ${p.name}` : ''}
          </div>
          <div className="eyebrow" style={{ marginTop: 4 }}>
            {formatDayLong(date)}
          </div>
        </div>
        <div className="eyebrow" style={{ marginTop: 14 }}>
          {date === today ? 'Тренировка сегодня' : date < today ? 'Прошедшая тренировка' : 'Следующая тренировка'}
        </div>
        <h1 className="display">
          {day.template.name}
          <br />
          <em>{muscles}.</em>
        </h1>
        <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
          {day.week >= 0 ? (
            <span className="chip">
              Неделя {day.week + 1} из {totalWeeks}
            </span>
          ) : (
            <span className="chip">До старта программы</span>
          )}
          <span className="chip">~{minutes} мин</span>
          {day.deload && <span className="chip blue">Разгрузка: веса ниже</span>}
        </div>
      </header>

      <nav className="glass daystrip fade-in" aria-label="Тренировочные дни">
        <button className="arrow" disabled={!prevDay} onClick={() => go(prevDay?.date, 'r')} aria-label="Предыдущая тренировка">
          ‹
        </button>
        <div className="days-scroll" ref={stripRef}>
          {all.map((d) => (
            <button
              key={d.date}
              data-date={d.date}
              className={`dayc ${d.date === date ? 'on' : ''}`}
              onClick={() => d.date !== date && go(d.date, d.date > date ? 'l' : 'r')}
            >
              <span>{d.date === today ? 'Сегодня' : WD[weekday(d.date) - 1]}</span>
              <span>{shortDate(d.date)}</span>
              <span className={`st ${state.logs[d.date]?.completed ? 'done' : d.date === date ? 'cur' : ''}`}>{state.logs[d.date]?.completed && <CheckIcon />}</span>
            </button>
          ))}
        </div>
        <button className="arrow" disabled={!nextDay} onClick={() => go(nextDay?.date, 'l')} aria-label="Следующая тренировка">
          ›
        </button>
      </nav>

      <div key={date} className={`stack slide-${dir}`}>
      <div className="glass progress-card fade-in">
        <span>
          <b>{done}</b> / {allSets.length} подходов
        </span>
        <div className="progress" style={{ flex: 1 }}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className="muted small">{pct}%</span>
      </div>

      <div className="row between">
        <span className="eyebrow">Упражнения</span>
        <button className={`chip ${ordering ? 'wine' : ''}`} onClick={() => setOrdering(!ordering)}>
          {ordering ? 'Готово' : '⇅ Порядок'}
        </button>
      </div>

      {ordering ? (
        <OrderList ids={day.exercises.map((e) => e.exerciseId)} templateId={day.template.id} />
      ) : (
        day.exercises.map((pe) => <ExerciseCard key={pe.exerciseId} date={date} plan={pe} locked={completed} />)
      )}

      <button className={`btn block ${completed ? 'ghost' : ''}`} onClick={() => dispatch({ type: 'complete', date, completed: !completed })}>
        {completed ? 'Отметить как невыполненную' : 'Завершить тренировку'}
      </button>
      {!completed && (
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          После завершения план следующих недель подстроится под фактические веса и повторы.
        </p>
      )}

      <Summary date={date} exercises={day.exercises} />
      </div>
    </div>
  )
}

/** Одинаковые подряд подходы сворачиваем: «2 × 12 · 30 кг» */
const groupSets = (sets: SetLog[]) => {
  const out: { n: number; reps: number; weight: number }[] = []
  for (const s of sets) {
    const last = out[out.length - 1]
    if (last && last.reps === s.reps && last.weight === s.weight) last.n++
    else out.push({ n: 1, reps: s.reps, weight: s.weight })
  }
  return out
}

/** Сводка в конце тренировки: что сделано (или что по плану, если подходы ещё не отмечены) */
function Summary({ date, exercises }: { date: string; exercises: PlannedExercise[] }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const rows = exercises.map((pe) => {
    const ex = exerciseById(pe.exerciseId)
    const all = setsOf(state, date, pe)
    const done = all.filter((s) => s.done)
    const rec = recommendedPlan(state, ex.id, date).weight
    return { ex, all, done, rec }
  })
  const total = rows.reduce((n, r) => n + r.done.length, 0)
  const tonnage = rows.reduce((n, r) => n + r.done.reduce((m, s) => m + s.weight * s.reps, 0), 0)
  return (
    <section className="glass card summary fade-in">
      <button className="summary-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span className="eyebrow">Сводка тренировки</span>
          <span className="muted small" style={{ display: 'block', marginTop: 4 }}>
            {total} подходов{tonnage > 0 ? ` · ${fmtKg(tonnage)} кг суммарно` : ''}
          </span>
        </span>
        <span className="summary-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <table className="summary-table">
          <thead>
            <tr>
              <th>Упражнение</th>
              <th>Подх.</th>
              <th>Повторы × вес</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ex, all, done, rec }) => (
              <tr key={ex.id} className={done.length ? '' : 'todo'}>
                <td>{ex.name}</td>
                <td className="num">
                  {done.length}/{all.length}
                </td>
                <td>
                  {groupSets(done.length ? done : all).map((g, i) => (
                    <div key={i}>
                      {g.n > 1 && `${g.n} × `}
                      {g.reps}
                      {ex.bodyweight ? '' : (
                        <>
                          {' · '}
                          <span className={g.weight > rec ? 'over-w' : ''}>{fmtKg(g.weight)} кг</span>
                        </>
                      )}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && rows.some((r) => !r.done.length) && <p className="muted small" style={{ margin: '8px 0 0' }}>Бледным — ещё не отмечено, показан план.</p>}
    </section>
  )
}

/** Порядок упражнений меняется в самой тренировке (A или B), поэтому сразу действует во всех её днях */
const ORDER_KEY = 'gym-diary/ordering'

function OrderList({ ids, templateId }: { ids: string[]; templateId: string }) {
  const { state, dispatch } = useStore()
  // Перетаскивание за ручку: строка едет за пальцем, остальные расступаются
  const [drag, setDrag] = useState<{ from: number; startY: number; startScroll: number; dy: number; h: number } | null>(null)

  const save = (order: string[]) => {
    const templates = state.templates.map((t) =>
      t.id !== templateId ? t : { ...t, exerciseIds: [...order, ...t.exerciseIds.filter((id) => !order.includes(id))] },
    )
    dispatch({ type: 'templates', templates })
  }
  const targetOf = (d: NonNullable<typeof drag>) => Math.min(ids.length - 1, Math.max(0, d.from + Math.round(d.dy / d.h)))

  const onDown = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    const row = e.currentTarget.closest('.order-row') as HTMLElement
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: i, startY: e.clientY, startScroll: window.scrollY, dy: 0, h: row.offsetHeight })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    // у краёв экрана список подкручивается, чтобы можно было утащить строку вниз под меню или наверх
    if (e.clientY > window.innerHeight - 140) window.scrollBy(0, 10)
    else if (e.clientY < 90) window.scrollBy(0, -10)
    setDrag({ ...drag, dy: e.clientY - drag.startY + window.scrollY - drag.startScroll })
  }
  const onUp = () => {
    if (!drag) return
    const to = targetOf(drag)
    if (to !== drag.from) {
      const order = [...ids]
      const [moved] = order.splice(drag.from, 1)
      order.splice(to, 0, moved)
      save(order)
    }
    setDrag(null)
  }

  const to = drag ? targetOf(drag) : -1
  return (
    <section className="glass card fade-in stack" style={{ gap: 0 }}>
      <p className="muted" style={{ margin: '0 0 8px' }}>
        Перетащи упражнение за ручку ≡. Новый порядок сохранится для всех будущих тренировок «
        {state.templates.find((t) => t.id === templateId)?.name}».
      </p>
      {ids.map((id, i) => {
        let shift = 0
        if (drag && i !== drag.from) {
          if (drag.from < i && i <= to) shift = -drag.h
          if (to <= i && i < drag.from) shift = drag.h
        }
        const lifted = drag?.from === i
        return (
          <div
            key={id}
            className={`order-row ${lifted ? 'lifted' : ''}`}
            style={{ transform: `translateY(${lifted ? drag!.dy : shift}px)` }}
          >
            <span className="n">{lifted ? to + 1 : i + 1 + Math.sign(shift)}</span>
            <button className="order-open" aria-label={`Об упражнении: ${exerciseById(id).name}`} onClick={() => navigate(`/ex/${id}`)}>
              <Thumb className="order-thumb" exerciseId={id} />
              <span className="title order-name">{exerciseById(id).name}</span>
            </button>
            <span
              className="grip"
              role="button"
              aria-label={`Перетащить: ${exerciseById(id).name}`}
              onPointerDown={onDown(i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 8h14M5 12h14M5 16h14" />
              </svg>
            </span>
          </div>
        )
      })}
    </section>
  )
}

function ExerciseCard({ date, plan, locked }: { date: string; plan: PlannedExercise; locked: boolean }) {
  const { state, dispatch } = useStore()
  const ex = exerciseById(plan.exerciseId)
  const machine = machineById(ex.machineId)
  const settings = settingsFor(state, ex)
  const logged = state.logs[date]?.exercises[ex.id] ?? copiedSets(state, date, ex.id)
  const [open, setOpen] = useState(false)
  const sets: SetLog[] = logged ?? Array.from({ length: plan.sets }, () => ({ weight: plan.weight, reps: plan.reps, done: false }))
  const doneCount = sets.filter((s) => s.done).length
  const weights = stackWeights(state, ex)
  const step = stepFor(state, ex)
  // Рост нагрузки относительно прошлой тренировки показываем, пока подходы не записаны
  const g = logged ? { weight: false, reps: false, sets: false } : growth(plan, previousPlan(state, ex.id, date))
  const prev = logged ? undefined : previousPlan(state, ex.id, date)
  const rec = recommendedPlan(state, ex.id, date).weight
  const isOver = (w: number) => !ex.bodyweight && w > rec
  const top = Math.max(...sets.map((s) => s.weight))

  const update = (i: number, patch: Partial<SetLog>) => {
    if (locked) return
    const next = sets.map((s, j) => (j === i ? { ...s, ...patch } : s))
    // Изменённые вес и повторы переносим на следующие ещё не выполненные подходы
    for (let j = i + 1; j < next.length; j++) {
      if (next[j].done) continue
      if (patch.weight !== undefined) next[j].weight = patch.weight
      if (patch.reps !== undefined) next[j].reps = patch.reps
    }
    dispatch({ type: 'logSets', date, exerciseId: ex.id, sets: next })
  }

  const toggle = (i: number) => update(i, { done: !sets[i].done })

  return (
    <section className="glass card fade-in excard">
      <div className="excard-head">
        <button className="thumb-link" aria-label="Об упражнении" onClick={() => navigate(`/ex/${ex.id}`)}>
          <Thumb className="ex-photo" exerciseId={ex.id} />
        </button>
        <div className="stack" style={{ gap: 10, minWidth: 0, flex: 1 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow">{machine.brand}</div>
              <div className="title">{ex.name}</div>
            </div>
            <button className="iconbtn" aria-label="Об упражнении" onClick={() => navigate(`/ex/${ex.id}`)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>
          {ex.settings.length > 0 && (
            <div className="row wrap" style={{ gap: 6 }}>
              {ex.settings.map((s) => (
                <span key={s.key} className="chip">
                  {s.label}: <b>{settings[s.key]}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="tiles">
        {sets.map((s, i) => (
          <button
            key={i}
            className={`tile ${s.done ? 'on' : ''} ${g.sets && prev && i >= prev.sets ? 'up-tile' : ''}`}
            disabled={locked}
            onClick={() => toggle(i)}
            aria-label={`Подход ${i + 1}: ${s.reps} повторов`}
          >
            <span className="st">{s.done && <CheckIcon />}</span>
            <span>
              <span className={g.reps ? 'up' : ''}>{s.reps}</span> ×<br />
              {ex.bodyweight ? 'свой вес' : <span className={isOver(s.weight) ? 'over-w' : g.weight ? 'up' : ''}>{fmtKg(s.weight)} кг</span>}
            </span>
          </button>
        ))}
        {!locked && (
          <button className={`tile edit ${open ? 'on-edit' : ''}`} aria-label="Изменить подходы" onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" />
            </svg>
          </button>
        )}
      </div>

      {isOver(top) && (
        <div className="up-note">
          <span className="chip over">
            +{fmtKg(top - rec)} кг сверх рек. {fmtKg(rec)} кг
          </span>
          <span className="muted small">в следующий раз станет рекомендованным</span>
        </div>
      )}

      {(g.weight || g.reps || g.sets) && prev && (
        <div className="up-note">
          {g.weight && <span className="chip blue">↑ вес {fmtKg(prev.weight)} → {fmtKg(plan.weight)} кг</span>}
          {g.reps && <span className="chip blue">↑ повторы {prev.reps} → {plan.reps}</span>}
          {g.sets && <span className="chip blue">↑ подходы {prev.sets} → {plan.sets}</span>}
        </div>
      )}

      {open && !locked && (
        <div className="sets">
          <div className="set eyebrow" style={{ fontSize: 9 }}>
            <span />
            <span style={{ textAlign: 'center' }}>{ex.bodyweight ? '' : 'Вес, кг'}</span>
            <span style={{ textAlign: 'center' }}>Повторы</span>
            <span />
          </div>
          {sets.map((s, i) => (
            <div key={i} className="set">
              <span className="n">{i + 1}</span>
              {ex.bodyweight ? (
                <span className="muted small" style={{ textAlign: 'center' }}>
                  свой вес
                </span>
              ) : (
                <Stepper over={isOver(s.weight)} value={s.weight} step={step} min={weights[0]} max={weights[weights.length - 1]} onChange={(w) => update(i, { weight: w })} />
              )}
              {locked ? (
                <span className="plan-num" style={{ textAlign: 'center', fontSize: 16 }}>
                  {s.reps}
                </span>
              ) : (
                <NumberPicker
                  compact
                  label={`Повторы, подход ${i + 1}`}
                  value={s.reps}
                  quick={ex.quickStep ?? 5}
                  step={ex.repStep ?? 1}
                  min={ex.repStep ?? 1}
                  onChange={(v) => update(i, { reps: v })}
                />
              )}
              <button className={`check ${s.done ? 'on' : ''}`} aria-label="Подход выполнен" onClick={() => update(i, { done: !s.done })}>
                <CheckIcon />
              </button>
            </div>
          ))}
          <div className="row between">
            <span className="muted small">
              Подходы · выполнено {doneCount} из {sets.length}
            </span>
            {!locked && (
              <NumberPicker
                label="Подходы"
                value={sets.length}
                quick={1}
                max={10}
                onChange={(n) =>
                  dispatch({
                    type: 'logSets',
                    date,
                    exerciseId: ex.id,
                    sets: n < sets.length ? sets.slice(0, n) : [...sets, ...Array.from({ length: n - sets.length }, () => ({ ...sets[sets.length - 1], done: false }))],
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
