import { exerciseById, isAvailable, machineById } from '../data/machines'
import type { Anchor, AppState, Exercise, Goal, PlannedDay, PlannedExercise, Profile, SetLog, StackSpec } from '../types'
import { addDays, addMonths, diffDays, mondayOf, weekday } from './date'

const EXPERIENCE_INDEX = { beginner: 0, intermediate: 1, advanced: 2 } as const

export const roundTo = (w: number, step: number) => Math.round(w / step) * step
const floorTo = (w: number, step: number) => Math.floor(w / step + 1e-9) * step

/** Стек тренажёра: из настроек пользователя, иначе из каталога */
export const stackOf = (state: AppState, machineId: string): StackSpec => {
  const m = machineById(machineId)
  const own = state.machineStacks?.[machineId]
  return own ?? { min: m.minWeight, step: state.machineSteps[machineId] ?? m.weightStep, max: m.maxWeight }
}

export const stepFor = (state: AppState, ex: Exercise) => stackOf(state, ex.machineId).step

export const suggestStartWeight = (ex: Exercise, p: Profile, step: number) => {
  if (ex.bodyweight) return 0
  const ratio = ex.startRatio[EXPERIENCE_INDEX[p.experience]] * (p.sex === 'f' ? ex.femaleFactor : 1)
  const m = machineById(ex.machineId)
  return Math.min(m.maxWeight, Math.max(m.minWeight, roundTo(p.weightKg * ratio, step)))
}

/** Все веса грузового стека от самой лёгкой плиты до максимума */
export const stackWeights = (state: AppState, ex: Exercise) => {
  const { min, step, max } = stackOf(state, ex.machineId)
  if (ex.bodyweight || step <= 0) return [0]
  const list: number[] = []
  for (let w = min; w <= max + 1e-9; w += step) list.push(Math.round(w * 100) / 100)
  return list
}

export const startWeightFor = (state: AppState, ex: Exercise) =>
  state.overrides[ex.id]?.startWeight ?? suggestStartWeight(ex, state.profile!, stepFor(state, ex))

export const settingsFor = (state: AppState, ex: Exercise) =>
  Object.fromEntries(
    ex.settings.map((s) => [s.key, state.overrides[ex.id]?.settings?.[s.key] ?? s.suggest(state.profile!)]),
  ) as Record<string, number>

export const weekIndex = (iso: string, startDate: string) =>
  Math.floor(diffDays(mondayOf(iso), mondayOf(startDate)) / 7)

/** Каждая 4-я неделя — разгрузочная */
/** Разгрузочных недель нет: по просьбе пользователя веса только растут и закрепляются, без снижения */
export const isDeloadWeek = (_week: number) => false

/** Число недель с прогрессией в интервале (from, to] */
export const progressWeeks = (from: number, to: number) => {
  let n = 0
  for (let w = from + 1; w <= to; w++) if (!isDeloadWeek(w)) n++
  return n
}

/** Диапазон повторов: от выбранного пользователем числа (или базового) с шириной базового диапазона */
export const repRange = (state: AppState, ex: Exercise) => {
  const min = state.overrides[ex.id]?.reps ?? ex.repMin
  return { min, max: min + (ex.repMax - ex.repMin) }
}

export const setsFor = (state: AppState, ex: Exercise, _week: number) =>
  state.overrides[ex.id]?.sets ?? 3

const normalize = (ex: Exercise, range: { min: number; max: number }, weight: number, reps: number, step: number) => {
  const m = machineById(ex.machineId)
  const r = ex.repStep ?? 1
  if (!ex.bodyweight && step > 0) {
    while (reps > range.max && weight + step <= m.maxWeight) {
      weight += step
      reps = range.min + (reps - range.max - r)
    }
    while (reps < range.min && weight - step >= m.minWeight) {
      weight -= step
      reps = range.min
    }
  }
  reps = Math.min(Math.max(reps, range.min), range.max)
  return { weight, reps: Math.ceil(reps / r) * r }
}

export const anchorFor = (state: AppState, ex: Exercise, date: string): Anchor => {
  const list = state.anchors[ex.id] ?? []
  let best: Anchor | undefined
  for (const a of list) if (a.date <= date && (!best || a.date >= best.date)) best = a
  return best ?? { date: state.profile!.startDate, weight: startWeightFor(state, ex), reps: repRange(state, ex).min }
}

export const planExercise = (state: AppState, exerciseId: string, date: string): PlannedExercise => {
  const ex = exerciseById(exerciseId)
  const p = state.profile!
  const step = stepFor(state, ex)
  const range = repRange(state, ex)
  const anchor = anchorFor(state, ex, date)
  const week = weekIndex(date, p.startDate)
  const repsPerWeek = ex.repStep ?? (p.experience === 'beginner' ? 2 : 1)
  const weeks = progressWeeks(weekIndex(anchor.date, p.startDate), week)
  // Повторы фиксированы (по умолчанию 15): вес растёт на шаг раз в две недели, вторая неделя — закрепление
  const gain = range.min === range.max ? Math.floor(weeks / 2) : weeks * repsPerWeek
  let { weight, reps } = normalize(ex, range, anchor.weight, anchor.reps + gain, step)
  const deload = isDeloadWeek(week)
  let sets = setsFor(state, ex, week)
  if (deload) {
    sets = Math.max(1, sets - 1)
    if (!ex.bodyweight) weight = Math.max(machineById(ex.machineId).minWeight, floorTo(weight * 0.85, step))
    reps = range.min
  }
  return { exerciseId, sets, reps, weight, deload }
}

export const programEnd = (p: Profile) => addMonths(p.startDate, p.months)

/** Все тренировочные дни программы в интервале [from, to] */
export const plannedDays = (state: AppState, from: string, to: string): PlannedDay[] => {
  const p = state.profile
  if (!p || state.templates.length === 0) return []
  const end = programEnd(p)
  const days: PlannedDay[] = []
  // Отмеченные вручную прошлые тренировки могут быть раньше старта программы.
  // Чередование отсчитываем от первой тренировки программы: она всегда A, отмеченные до неё идут назад (B, A, …),
  // поэтому отметка прошлых дней не сдвигает уже сделанные и будущие тренировки
  const first = Object.keys(state.dayOverrides ?? {})
    .filter((d) => state.dayOverrides[d])
    .reduce((m, d) => (d < m ? d : m), p.startDate)
  let session = 0
  for (let d = first; d < p.startDate; d = addDaysFast(d)) if (isTrainingDay(state, d)) session--
  const n = state.templates.length
  let idx = ((session % n) + n) % n
  for (let d = first; d < end && d <= to; d = addDaysFast(d)) {
    if (!isTrainingDay(state, d)) continue
    const chosen = state.templateOverrides?.[d]
    const forced = chosen ? state.templates.findIndex((t) => t.id === chosen) : -1
    const cur = forced >= 0 ? forced : idx
    const skipped = !!state.skipped?.[d]
    if (d >= from) {
      const template = state.templates[cur]
      const week = weekIndex(d, p.startDate)
      days.push({
        date: d,
        template,
        week,
        deload: isDeloadWeek(week),
        exercises: template.exerciseIds.filter(isAvailable).map((id) => planExercise(state, id, d)),
        ...(skipped ? { skipped } : {}),
      })
    }
    // Пропущенная тренировка не сдвигает чередование: в следующий раз будет она же.
    // Выбранная вручную — продолжает чередование от себя (сделала A подряд — дальше B)
    if (!skipped) idx = (cur + 1) % n
  }
  return days
}

/** Тренировочный день: ручная отметка в календаре или день недели из профиля */
export const isTrainingDay = (state: AppState, d: string) =>
  state.dayOverrides?.[d] ?? (d >= state.profile!.startDate && state.profile!.trainingDays.includes(weekday(d)))

const addDaysFast = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const n = new Date(y, m - 1, d + 1)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export const plannedDay = (state: AppState, date: string) => plannedDays(state, date, date)[0]

/**
 * Прошлая тренировка, отмеченная в календаре без записи подходов, повторяет веса ближайшей
 * записанной тренировки того же типа (A — с A, B — с B): сначала ищем более позднюю, потом более раннюю.
 */
export const copiedSets = (state: AppState, date: string, exerciseId: string): SetLog[] | undefined => {
  const p = state.profile
  if (!p || !state.logs[date]?.completed || state.logs[date]?.exercises[exerciseId]) return undefined
  const days = plannedDays(state, '0000-01-01', programEnd(p))
  const tid = days.find((d) => d.date === date)?.template.id
  if (!tid) return undefined
  const same = days.filter((d) => d.template.id === tid && d.date !== date && state.logs[d.date]?.exercises[exerciseId]?.some((s) => s.done))
  const src = same.find((d) => d.date > date) ?? same.reverse().find((d) => d.date < date)
  return src && state.logs[src.date].exercises[exerciseId].filter((s) => s.done).map((s) => ({ ...s, done: true }))
}

/** Рекомендованный на дату план: без точек прогрессии, поставленных в этот же день */
export const recommendedPlan = (state: AppState, exerciseId: string, date: string): PlannedExercise =>
  planExercise({ ...state, anchors: { ...state.anchors, [exerciseId]: (state.anchors[exerciseId] ?? []).filter((a) => a.date !== date) } }, exerciseId, date)

/** Самый большой вес среди отмеченных подходов, если он выше рекомендованного */
export const overWeight = (state: AppState, exerciseId: string, date: string, sets: SetLog[]): number | null => {
  const done = sets.filter((s) => s.done && s.weight > 0)
  if (!done.length || exerciseById(exerciseId).bodyweight) return null
  const top = Math.max(...done.map((s) => s.weight))
  return top > recommendedPlan(state, exerciseId, date).weight ? top : null
}

/** Точка прогрессии по фактически выполненным подходам */
export const anchorFromLog = (state: AppState, exerciseId: string, date: string, sets: SetLog[]): Anchor | null => {
  const ex0 = exerciseById(exerciseId)
  const done = sets.filter((s) => s.done && s.reps > 0 && (s.weight > 0 || ex0.bodyweight))
  if (done.length === 0) return null
  const ex = exerciseById(exerciseId)
  const top = Math.max(...done.map((s) => s.weight))
  const reps = Math.min(...done.filter((s) => s.weight === top).map((s) => s.reps))
  const n = normalize(ex, repRange(state, ex), top, reps, stepFor(state, ex))
  return { date, ...n }
}

/** Когда по плану будет достигнута цель */
export const projectGoal = (state: AppState, goal: Goal): string | null => {
  const p = state.profile
  if (!p) return null
  for (const day of plannedDays(state, p.startDate, programEnd(p))) {
    const e = day.exercises.find((x) => x.exerciseId === goal.exerciseId)
    if (!e || e.deload) continue
    if (e.weight > goal.targetWeight || (e.weight === goal.targetWeight && e.reps >= goal.targetReps)) return day.date
  }
  return null
}

/** Лучший фактический результат: макс. вес и повторы на нём */
export const bestResult = (state: AppState, exerciseId: string) => {
  let best: { weight: number; reps: number; date: string } | null = null
  for (const [date, log] of Object.entries(state.logs)) {
    for (const s of log.exercises[exerciseId] ?? []) {
      if (!s.done) continue
      if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps))
        best = { weight: s.weight, reps: s.reps, date }
    }
  }
  return best
}

export const history = (state: AppState, exerciseId: string) =>
  Object.entries(state.logs)
    .filter(([, l]) => l.exercises[exerciseId]?.some((s) => s.done))
    .map(([date, l]) => ({
      date,
      weight: Math.max(...l.exercises[exerciseId].filter((s) => s.done).map((s) => s.weight)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))


/** План того же упражнения на предыдущей тренировке — чтобы показать, что выросло */
export const previousPlan = (state: AppState, exerciseId: string, date: string): PlannedExercise | undefined => {
  const p = state.profile
  if (!p || date <= p.startDate) return undefined
  const days = plannedDays(state, p.startDate, addDays(date, -1))
  for (let i = days.length - 1; i >= 0; i--) {
    const e = days[i].exercises.find((x) => x.exerciseId === exerciseId)
    if (e) return e
  }
  return undefined
}

export const growth = (cur: PlannedExercise, prev?: PlannedExercise) => ({
  weight: !!prev && cur.weight > prev.weight,
  reps: !!prev && cur.reps > prev.reps && cur.weight >= prev.weight,
  sets: !!prev && cur.sets > prev.sets,
})
