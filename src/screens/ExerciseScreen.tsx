import { useMemo } from 'react'
import { ExerciseAnimation } from '../components/ExerciseAnimation'
import { Back, Section, Stepper, fmtKg, navigate } from '../components/ui'
import { EXERCISES, exerciseById, machineById, suggestSettings } from '../data/machines'
import { formatDay, todayISO } from '../lib/date'
import { growth, history, planExercise, previousPlan, repRange, setsFor, weekIndex, plannedDays, programEnd, settingsFor, stackOf, stackWeights, stepFor, suggestStartWeight } from '../lib/plan'
import { HolePicker } from '../components/pickers'
import { presetById } from '../data/lifeGoals'
import { NumberPicker } from '../components/NumberPicker'
import { useStore } from '../store'
import type { StackSpec } from '../types'
import { manifestEntry } from '../lib/assets'

/** Темп и отдых из manifest.json потока анимаций (встроен в сборку) */
const useManifest = (id: string) => manifestEntry(id)

export function ExerciseScreen({ id }: { id: string }) {
  const { state, dispatch } = useStore()
  const ex = exerciseById(id)
  const machine = machineById(ex.machineId)
  const p = state.profile!
  const settings = settingsFor(state, ex)
  const step = stepFor(state, ex)
  const today = todayISO()
  const upcoming = plannedDays(state, today, programEnd(p))
    .flatMap((d) => d.exercises.filter((e) => e.exerciseId === id).map((e) => ({ ...e, date: d.date })))
    .slice(0, 8)
    .map((u, i, list) => ({ ...u, g: growth(u, i > 0 ? list[i - 1] : previousPlan(state, id, u.date)) }))
  const started = today >= p.startDate
  // Рекомендованный вес — по плану без ручной правки за сегодня; выбранный — то, что указал пользователь
  const manual = (state.anchors[id] ?? []).find((a) => a.date === today)
  const withoutManual = { ...state, anchors: { ...state.anchors, [id]: (state.anchors[id] ?? []).filter((a) => a.date !== today) } }
  const recommended = started
    ? planExercise(withoutManual, id, upcoming[0]?.date ?? today).weight
    : suggestStartWeight(ex, p, step)
  const chosen = started ? manual?.weight : state.overrides[id]?.startWeight
  const weights = useMemo(() => stackWeights(state, ex), [state, ex])
  const user = useMemo(() => ({ height: p.heightCm, mass: p.weightKg }), [p.heightCm, p.weightKg])
  const autoSettings = suggestSettings(ex, p)
  const range = repRange(state, ex)
  const sets = setsFor(state, ex, Math.max(0, weekIndex(today, p.startDate)))
  const goalsFor = (state.lifeGoals ?? []).filter((g) => !g.done && presetById(g.preset)?.exercises.includes(id))
  const siblings = EXERCISES.filter((e) => e.machineId === ex.machineId && e.id !== id)
  const manifest = useManifest(id)

  return (
    <div className="stack">
      <div>
        <Back to="/machines" />
        <div className="eyebrow">
          {machine.brand}
          {machine.model ? ` ${machine.model}` : ''} · {machine.name}
        </div>
        {/* Длинное слово («ГОРИЗОНТАЛЬНАЯ») уменьшает шрифт, чтобы не вылезать за экран */}
        <h1 className="display" style={{ fontSize: `min(38px, calc((100vw - 40px) / ${(Math.max(...ex.name.split(' ').map((w) => w.length)) * 0.9).toFixed(1)}))`, marginTop: 6 }}>
          {ex.name}
        </h1>
        <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
          {ex.muscles.map((m, i) => (
            <span key={m} className={`chip ${i === 0 ? 'rose' : ''}`}>
              {m}
            </span>
          ))}
          <span className="chip">
            {range.min === range.max ? range.min : `${range.min}–${range.max}`} повторов
          </span>
          {manifest?.tempo && <span className="chip">темп {manifest.tempo}</span>}
          {manifest?.rest_sec && <span className="chip">отдых {manifest.rest_sec} с</span>}
        </div>
      </div>

      <ExerciseAnimation
        exerciseId={id}
        user={user}
        weights={weights}
        value={{ ...settings, weight: chosen ?? recommended, start: settings.roller }}
        rec={{ ...autoSettings, weight: recommended, start: autoSettings.roller }}
        onPick={(part) => {
          const el = document.getElementById(`pick-${part}`)
          if (!el) return
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.remove('flash')
          void el.offsetWidth
          el.classList.add('flash')
        }}
      />

      {ex.settings.length > 0 && (
        <Section
          eyebrow="Подобрано по росту"
          title="Твои настройки"
          action={
            state.overrides[id]?.settings && (
              <button className="link" onClick={() => dispatch({ type: 'override', exerciseId: id, patch: { settings: undefined, startWeight: state.overrides[id]?.startWeight } })}>
                Сбросить
              </button>
            )
          }
        >
          {ex.settings.map((s) => {
            const auto = s.suggest(p)
            const edited = settings[s.key] !== auto
            return (
              <div key={s.key} id={`pick-${s.key === 'roller' ? 'start' : s.key}`} className="stack" style={{ gap: 8, borderRadius: 18 }}>
                <div className="row between">
                  <div>{s.label}</div>
                  <span className={`chip ${edited ? 'wine' : 'blue'}`}>
                    {s.unit} {settings[s.key]} · {edited ? 'выбрано' : 'рекомендовано'}
                  </span>
                </div>
                <HolePicker
                  label={s.label}
                  count={s.max}
                  ends={s.ends}
                  value={settings[s.key]}
                  suggested={auto}
                  onChange={(v) => dispatch({ type: 'override', exerciseId: id, patch: { settings: { [s.key]: v } } })}
                />
                <div className="muted desc">
                  {s.hint}
                  {edited && ` Рекомендовано: ${auto}.`}
                </div>
                <hr className="thin" />
              </div>
            )
          })}
          <p className="muted small" style={{ margin: 0 }}>
            Голубым обведено рекомендованное по росту отверстие. Нажми на другое, если так удобнее: приложение запомнит.
          </p>
        </Section>
      )}

      <Section eyebrow="Объём" title="Подходы и повторы">
        <div className="row between wrap">
          <span>Подходы</span>
          <NumberPicker label="Подходы" value={sets} quick={1} max={10} onChange={(v) => dispatch({ type: 'override', exerciseId: id, patch: { sets: v } })} />
        </div>
        <div className="row between wrap">
          <span>Повторы</span>
          <NumberPicker
            label="Повторы"
            value={range.min}
            quick={ex.quickStep ?? 5}
            step={ex.repStep ?? 1}
            min={ex.repStep ?? 1}
            onChange={(v) => dispatch({ type: 'override', exerciseId: id, patch: { reps: v } })}
          />
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {ex.bodyweight
            ? `Повторы считаются по сторонам, поэтому только чётные. План добавляет по ${ex.repStep ?? 2} в неделю до ${range.max}.`
            : range.min === range.max
              ? `Повторов всегда ${range.min}. Вес растёт на один шаг раз в две недели: неделю поднимаешь, неделю закрепляешь.`
              : `План начинает с ${range.min} повторов, добавляет по неделям до ${range.max}, затем повышает вес и снова начинает с ${range.min}.`}
          {(state.overrides[id]?.reps !== undefined || state.overrides[id]?.sets !== undefined) && (
            <>
              {' '}
              <button className="link" onClick={() => dispatch({ type: 'override', exerciseId: id, patch: { reps: undefined, sets: undefined } })}>
                Вернуть по умолчанию
              </button>
            </>
          )}
        </p>
      </Section>

      {!ex.bodyweight && (
      <Section eyebrow="Нагрузка" title="Рабочий вес">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="chip blue">рекомендовано {fmtKg(recommended)} кг</span>
          {chosen !== undefined && chosen !== recommended && (
            <span className={`chip ${chosen > recommended ? 'over' : 'wine'}`}>
              выбрано {fmtKg(chosen)} кг{chosen > recommended ? ` · +${fmtKg(chosen - recommended)} сверх рек.` : ''}
            </span>
          )}
        </div>
        <div id="pick-weight" className="row between" style={{ borderRadius: 18, padding: '4px 0' }}>
          <span>{started ? 'Работаю с весом' : 'Стартовый вес'}</span>
          <Stepper
            over={(chosen ?? recommended) > recommended}
            value={chosen ?? recommended}
            step={step}
            min={weights[0]}
            max={weights[weights.length - 1]}
            unit="кг"
            onChange={(w) =>
              started
                ? dispatch({ type: 'setWeight', exerciseId: id, date: today, weight: w, reps: range.min })
                : dispatch({ type: 'override', exerciseId: id, patch: { startWeight: w } })
            }
          />
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {started
            ? `Кнопками − и + укажи вес, с которым работаешь сейчас (на ${range.min} повторов): план дальше пойдёт от него.`
            : 'Кнопками − и + выбери стартовый вес вместо рекомендованного.'}
        </p>
        {chosen !== undefined && chosen !== recommended && (
          <button
            className="link"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              started
                ? dispatch({ type: 'clearWeight', exerciseId: id, date: today })
                : dispatch({ type: 'override', exerciseId: id, patch: { startWeight: undefined } })
            }
          >
            Вернуть рекомендованный
          </button>
        )}
        <StackEditor machineId={machine.id} />
      </Section>
      )}

      {upcoming.length > 0 && (
        <Section eyebrow="Ближайшие тренировки" title="План">
          <p className="muted" style={{ margin: 0 }}>
            Голубым отмечено то, что растёт по сравнению с прошлой тренировкой.
          </p>
          {upcoming.map((u) => (
            <button key={u.date} className="row between" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => navigate(`/day/${u.date}`)}>
              <span>
                {formatDay(u.date)}
                {u.deload && <span className="muted small"> · разгрузка</span>}
              </span>
              <span className="plan-num" style={{ fontSize: 19 }}>
                <span className={u.g.sets ? 'up' : ''}>{u.sets}</span>×<span className={u.g.reps ? 'up' : ''}>{u.reps}</span>
                {!ex.bodyweight && (
                  <>
                    {' · '}
                    <span className={u.g.weight ? 'up' : ''}>{fmtKg(u.weight)}</span>
                    <small>кг</small>
                  </>
                )}
              </span>
            </button>
          ))}
        </Section>
      )}

      <HistoryChart id={id} />

      <Section eyebrow={ex.bodyweight ? 'Подготовка' : 'Настройка тренажёра'} title={ex.bodyweight ? 'Исходное положение' : 'Перед подходом'}>
        {machine.notes && <p className="muted small" style={{ margin: 0 }}>{machine.notes}</p>}
        <ol className="steps">
          {ex.setup.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Техника" title="Как выполнять">
        <ol className="steps">
          {ex.technique.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Внимание" title="Частые ошибки">
        <ul className="dots">
          {ex.mistakes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Цели" title={goalsFor.length ? 'Работает на цели' : 'Цели на будущее'}>
        {goalsFor.length > 0 && (
          <div className="row wrap" style={{ gap: 6 }}>
            {goalsFor.map((g) => (
              <span key={g.id} className="chip rose">
                {g.title}
              </span>
            ))}
          </div>
        )}
        <button className="btn rose sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/goals')}>
          {goalsFor.length ? 'Мои цели' : 'Поставить цель'}
        </button>
      </Section>

      {siblings.length > 0 && (
        <Section eyebrow="На этом же тренажёре">
          {siblings.map((s) => (
            <button key={s.id} className="link" style={{ textAlign: 'left' }} onClick={() => navigate(`/ex/${s.id}`)}>
              {s.name} →
            </button>
          ))}
        </Section>
      )}
    </div>
  )
}

function HistoryChart({ id }: { id: string }) {
  const { state } = useStore()
  const points = history(state, id)
  if (points.length < 2) return null
  const w = 320
  const h = 120
  const min = Math.min(...points.map((p) => p.weight))
  const max = Math.max(...points.map((p) => p.weight))
  const span = Math.max(max - min, 1)
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (w - 20) + 10, h - 16 - ((p.weight - min) / span) * (h - 36)])
  return (
    <Section eyebrow="История" title="Прогресс веса">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="График рабочего веса">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#5B9BE0" stopOpacity="0.35" />
            <stop offset="1" stopColor="#5B9BE0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${xy[0][0]},${h - 10} L${xy.map((p) => p.join(',')).join(' L')} L${xy[xy.length - 1][0]},${h - 10} Z`} fill="url(#fill)" />
        <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="#7D1F2B" strokeWidth="2" strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="#FFFFFF" stroke="#7D1F2B" strokeWidth="1.5" />
        ))}
        <text x="10" y="12" fontSize="10" fill="#86606A">
          {fmtKg(max)} кг
        </text>
      </svg>
      <div className="row between muted small">
        <span>{formatDay(points[0].date)}</span>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </div>
    </Section>
  )
}

/** Грузовой стек тренажёра: первая плита, шаг и максимум, как на табличках в зале. Общий для всех упражнений на тренажёре */
function StackEditor({ machineId }: { machineId: string }) {
  const { state, dispatch } = useStore()
  const st = stackOf(state, machineId)
  const own = !!state.machineStacks?.[machineId]
  const set = (patch: Partial<StackSpec>) => {
    const next = { ...st, ...patch }
    if (next.max < next.min) next.max = next.min
    dispatch({ type: 'machineStack', machineId, stack: next })
  }
  return (
    <div className="stack" style={{ gap: 10, marginTop: 6 }}>
      <div className="row between">
        <span className="eyebrow">Грузовой стек тренажёра</span>
        <span className={`chip ${own ? 'wine' : 'blue'}`}>{own ? 'сверено в зале' : 'по каталогу'}</span>
      </div>
      <div className="row between">
        <span>Первая плита</span>
        <Stepper value={st.min} step={0.5} min={0} max={50} unit="кг" onChange={(v) => set({ min: v })} />
      </div>
      <div className="row between">
        <span>Шаг плит</span>
        <Stepper value={st.step} step={0.25} min={0.25} max={20} unit="кг" onChange={(v) => set({ step: v })} />
      </div>
      <div className="row between">
        <span>Максимум</span>
        <Stepper value={st.max} step={st.step} min={st.min} max={300} unit="кг" onChange={(v) => set({ max: v })} />
      </div>
      <p className="muted desc" style={{ margin: 0 }}>
        Посмотри на таблички на плитах и выставь как в зале: кнопки − и + будут менять вес ровно на шаг этого тренажёра.
        {own && (
          <>
            {' '}
            <button className="link" onClick={() => dispatch({ type: 'machineStack', machineId, stack: null })}>
              Сбросить
            </button>
          </>
        )}
      </p>
    </div>
  )
}
