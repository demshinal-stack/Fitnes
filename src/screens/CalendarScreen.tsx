import { useMemo, useState } from 'react'
import { Brand } from '../components/Brand'
import { exerciseById } from '../data/machines'
import { GROUP_CLASSES, type GroupClass } from '../data/groups'
import { MONTHS, WEEKDAYS_SHORT, addDays, formatDayLong, mondayOf, parseISO, toISO, todayISO, weekday } from '../lib/date'
import { isTrainingDay, plannedDays, programEnd, weekIndex } from '../lib/plan'
import { useStore } from '../store'
import type { PlannedDay } from '../types'
import { Section, fmtKg, navigate, useSwipe } from '../components/ui'

export function CalendarScreen() {
  const { state, dispatch } = useStore()
  const p = state.profile!
  const today = todayISO()
  const [editing, setEditing] = useState(false)
  const [month, setMonth] = useState(() => {
    const base = today < p.startDate ? p.startDate : today
    return base.slice(0, 7)
  })

  const gridStart = mondayOf(`${month}-01`)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const planned = useMemo(() => {
    const map = new Map<string, PlannedDay>()
    for (const d of plannedDays(state, cells[0], cells[41])) map.set(d.date, d)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, month])

  const next = useMemo(() => plannedDays(state, today, programEnd(p)).find((d) => !state.logs[d.date]?.completed), [state, today, p])
  const totalWeeks = weekIndex(addDays(programEnd(p), -1), p.startDate) + 1
  const curWeek = Math.min(Math.max(weekIndex(today, p.startDate) + 1, 0), totalWeeks)

  // Прошлый день: тап отмечает, что тренировка была (или не была). Будущий: тренировка или отдых
  const toggleDay = (d: string) => {
    const scheduled = d >= p.startDate && p.trainingDays.includes(weekday(d))
    if (d < today) {
      const done = !!state.logs[d]?.completed && isTrainingDay(state, d)
      dispatch({ type: 'dayOverride', date: d, on: done ? (scheduled ? false : null) : true })
      dispatch({ type: 'complete', date: d, completed: !done })
    } else {
      const on = !isTrainingDay(state, d)
      dispatch({ type: 'dayOverride', date: d, on: on === scheduled ? null : on })
    }
  }

  const [dir, setDir] = useState<'l' | 'r' | ''>('')
  const shift = (n: number) => {
    const d = parseISO(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setDir(n > 0 ? 'l' : 'r')
    setMonth(toISO(d).slice(0, 7))
  }
  const swipe = useSwipe(
    () => shift(1),
    () => shift(-1),
  )
  const [y, m] = month.split('-').map(Number)
  const lastRow = cells.slice(35).every((c) => c.slice(0, 7) !== month)

  return (
    <div className="stack">
      <header className="header fade-in">
        <div className="row between">
          <Brand />
          <div className="eyebrow">
            {curWeek > 0 ? `Неделя ${curWeek} из ${totalWeeks}` : `Старт ${formatDayLong(p.startDate)}`}
          </div>
        </div>
        <h1 className="display" style={{ marginTop: 10 }}>
          {p.name ? `${p.name},` : 'Твой'}
          <br />
          <em>{p.name ? 'шаг за шагом.' : 'план.'}</em>
        </h1>
      </header>

      {next && <NextWorkout day={next} />}

      <section className={`glass card fade-in ${editing ? 'cal-editing' : ''}`}>
        <div className="cal-head">
          <div>
            <div className="eyebrow">{y}</div>
            <h2 className="title" style={{ textTransform: 'capitalize', fontSize: 30 }}>
              {MONTHS[m - 1]}
            </h2>
          </div>
          <div className="cal-nav">
            <button className="btn ghost round" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
              ‹
            </button>
            <button className="btn ghost round" aria-label="Следующий месяц" onClick={() => shift(1)}>
              ›
            </button>
          </div>
        </div>
        <div key={month} className={`cal-grid slide-${dir}`} {...swipe}>
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="cal-wd">
              {d}
            </div>
          ))}
          {(lastRow ? cells.slice(0, 35) : cells).map((d) => {
            const pd = planned.get(d)
            const done = state.logs[d]?.completed
            const visited = (state.groupVisits ?? []).some((v) => v.date === d)
            const cls = [
              'cal-day',
              d.slice(0, 7) !== month && 'out',
              pd && 'planned',
              pd?.deload && 'deload',
              visited && 'group',
              done && 'done',
              d === today && 'today',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button key={d} className={cls} onClick={() => (editing ? toggleDay(d) : pd ? navigate(`/day/${d}`) : visited && document.getElementById('groups')?.scrollIntoView({ behavior: 'smooth' }))} disabled={!editing && !pd && !visited}>
                {Number(d.slice(8))}
                {pd && <span className="tag">{pd.template.id}</span>}
                {visited && <span className="gr">гр</span>}
              </button>
            )
          })}
        </div>
        <button className={`btn block sm ${editing ? '' : 'ghost'}`} style={{ marginTop: 14 }} onClick={() => setEditing(!editing)}>
          {editing ? 'Готово' : 'Отметить дни тренировок'}
        </button>
        {editing && (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            Прошедший день: нажми, если в этот день была тренировка. Будущий день: нажми, чтобы добавить тренировку или сделать день отдыхом.
            Тренировки A и B чередуются: первая тренировка программы — A, отмеченные до неё идут назад (B, A, …).
          </p>
        )}
        <div className="legend">
          <span>
            <i style={{ background: 'rgba(255,255,255,.7)', boxShadow: 'inset 0 0 0 1px #fff' }} />
            по плану
          </span>
          <span>
            <i style={{ background: 'var(--wine)' }} />
            выполнено
          </span>
          {GROUP_CLASSES.length > 0 && (
            <span>
              <i style={{ background: 'var(--sky)' }} />
              групповое
            </span>
          )}
          <span>
            <i style={{ boxShadow: '0 0 0 2px var(--blue)' }} />
            сегодня
          </span>
        </div>
      </section>

      <div id="groups">
        <Section eyebrow="Можно ходить" title="Групповые">
          <p className="muted desc" style={{ margin: 0 }}>
            Сходила на занятие — нажми «+ Была» и выбери дату и время. В календаре этот день станет салатовым с «гр».
          </p>
          {GROUP_CLASSES.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </Section>
      </div>
    </div>
  )
}

/** Групповое занятие: отметка «была» с датой и временем и список посещений */
function GroupCard({ group }: { group: GroupClass }) {
  const { state, dispatch } = useStore()
  const today = todayISO()
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('19:00')
  const [showAll, setShowAll] = useState(false)
  const visits = (state.groupVisits ?? [])
    .filter((v) => v.classId === group.id)
    .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time))
  const thisMonth = visits.filter((v) => v.date.startsWith(today.slice(0, 7))).length
  return (
    <div className="group-card">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="eyebrow">{group.brand}</div>
          <div className="title" style={{ fontSize: 18 }}>
            {group.name}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>
            {group.minutes} минут{visits.length > 0 ? ` · была ${visits.length} раз, в этом месяце ${thisMonth}` : ''}
          </div>
        </div>
        <button className={`chip ${adding ? 'wine' : 'blue'}`} onClick={() => setAdding(!adding)}>
          {adding ? 'Отмена' : '+ Была'}
        </button>
      </div>
      {adding && (
        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
          <input className="input" type="date" value={date} max={addDays(today, 0)} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 110 }} />
          <button
            className="btn sm"
            disabled={!date || !time}
            onClick={() => {
              dispatch({ type: 'groupVisit', visit: { id: `${group.id}-${Date.now()}`, classId: group.id, date, time } })
              setAdding(false)
            }}
          >
            Сохранить
          </button>
        </div>
      )}
      {visits.length > 0 && (
        <div className="stack" style={{ gap: 4, marginTop: 8 }}>
          {(showAll ? visits : visits.slice(0, 3)).map((v) => (
            <div key={v.id} className="row between small">
              <span>
                {formatDayLong(v.date)} · {v.time}
              </span>
              <button className="link" style={{ color: 'var(--muted)' }} aria-label="Удалить отметку" onClick={() => dispatch({ type: 'removeGroupVisit', id: v.id })}>
                ✕
              </button>
            </div>
          ))}
          {visits.length > 3 && (
            <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Свернуть' : `Ещё ${visits.length - 3}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NextWorkout({ day }: { day: PlannedDay }) {
  const isToday = day.date === todayISO()
  return (
    <button className="glass card fade-in stack" style={{ textAlign: 'left', border: 0 }} onClick={() => navigate(`/day/${day.date}`)}>
      <div className="row between">
        <div className="eyebrow">{isToday ? 'Сегодня' : 'Следующая тренировка'}</div>
        <span className={`chip ${day.deload ? '' : 'rose'}`}>{day.deload ? 'Разгрузка' : day.template.name}</span>
      </div>
      <h2 className="title">
        {formatDayLong(day.date)}
      </h2>
      <div className="stack" style={{ gap: 8 }}>
        {day.exercises.map((e) => (
          <div key={e.exerciseId} className="row between small">
            <span>{exerciseById(e.exerciseId).name}</span>
            <span className="muted">
              {e.sets} × {e.reps} · {exerciseById(e.exerciseId).bodyweight ? 'свой вес' : `${fmtKg(e.weight)} кг`}
            </span>
          </div>
        ))}
      </div>
      <span className="link" style={{ alignSelf: 'flex-end' }}>
        Открыть →
      </span>
    </button>
  )
}
