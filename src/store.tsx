import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { useCloudSync, type CloudStatus } from './lib/cloud'
import { DEFAULT_TEMPLATES, EXERCISES, TEMPLATES_VERSION } from './data/machines'
import { anchorFromLog, isDeloadWeek, overWeight, weekIndex } from './lib/plan'
import type { AppState, DayLog, ExerciseOverride, Goal, GroupVisit, LifeGoal, Profile, SetLog, StackSpec, WorkoutTemplate } from './types'

const KEY = 'gym-diary/v1'

export const emptyState = (): AppState => ({
  version: 1,
  profile: null,
  overrides: {},
  machineSteps: {},
  templates: DEFAULT_TEMPLATES,
  logs: {},
  anchors: {},
  goals: [],
  knownExercises: EXERCISES.map((e) => e.id),
  templatesVersion: TEMPLATES_VERSION,
  dayOverrides: {},
})

/** Сохранённое состояние старой версии: без knownExercises значит «новых ещё не видел» */
const withDefaults = (saved: Partial<AppState>): AppState => ({
  ...emptyState(),
  ...saved,
  knownExercises: saved.knownExercises ?? [],
  templatesVersion: saved.templatesVersion ?? 1,
  // в первой версии посещения групповых хранились по датам без времени
  groupVisits: Array.isArray(saved.groupVisits) ? saved.groupVisits : [],
})

/** Новые упражнения из обновления приложения добавляем в те тренировки, где они стоят по умолчанию */
export const migrate = (saved: AppState): AppState => {
  const s =
    (saved.templatesVersion ?? 1) < TEMPLATES_VERSION
      ? { ...saved, templates: DEFAULT_TEMPLATES, templatesVersion: TEMPLATES_VERSION, knownExercises: EXERCISES.map((e) => e.id) }
      : saved
  const known = new Set(s.knownExercises ?? [])
  const fresh = EXERCISES.filter((e) => !known.has(e.id)).map((e) => e.id)
  if (fresh.length === 0) return s
  const templates = s.templates.map((t) => {
    const def = DEFAULT_TEMPLATES.find((d) => d.id === t.id)
    const add = fresh.filter((id) => def?.exerciseIds.includes(id) && !t.exerciseIds.includes(id))
    if (!add.length || !def) return t
    // ставим новые на их место в составе по умолчанию
    const ids = [...t.exerciseIds]
    for (const id of add) {
      const next = def.exerciseIds.slice(def.exerciseIds.indexOf(id) + 1).find((n) => ids.includes(n))
      ids.splice(next ? ids.indexOf(next) : ids.length, 0, id)
    }
    return { ...t, exerciseIds: ids }
  })
  return { ...s, templates, knownExercises: [...known, ...fresh] }
}

const load = (): AppState => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(withDefaults(JSON.parse(raw)))
  } catch {
    /* пустое хранилище или приватный режим */
  }
  return emptyState()
}

export type Action =
  | { type: 'profile'; profile: Profile }
  | { type: 'override'; exerciseId: string; patch: ExerciseOverride | null }
  | { type: 'machineStep'; machineId: string; step: number }
  | { type: 'machineStack'; machineId: string; stack: StackSpec | null }
  | { type: 'templates'; templates: WorkoutTemplate[] }
  | { type: 'logSets'; date: string; exerciseId: string; sets: SetLog[] }
  | { type: 'complete'; date: string; completed: boolean }
  | { type: 'setWeight'; exerciseId: string; date: string; weight: number; reps: number }
  | { type: 'clearWeight'; exerciseId: string; date: string }
  | { type: 'dayOverride'; date: string; on: boolean | null }
  | { type: 'skip'; date: string; on: boolean }
  | { type: 'extra'; date: string; exerciseId: string; on: boolean }
  | { type: 'templateFor'; date: string; templateId: string | null }
  | { type: 'goal'; goal: Goal }
  | { type: 'groupVisit'; visit: GroupVisit }
  | { type: 'removeGroupVisit'; id: string }
  | { type: 'lifeGoal'; goal: LifeGoal }
  | { type: 'removeLifeGoal'; id: string }
  | { type: 'removeGoal'; exerciseId: string }
  | { type: 'replace'; state: AppState }

const withoutDate = (list: AppState['anchors'][string] = [], date: string) => list.filter((a) => a.date !== date)

export const reducer = (s: AppState, a: Action): AppState => {
  switch (a.type) {
    case 'profile':
      return { ...s, profile: a.profile }
    case 'override': {
      const overrides = { ...s.overrides }
      if (a.patch === null) delete overrides[a.exerciseId]
      else
        overrides[a.exerciseId] = {
          ...overrides[a.exerciseId],
          ...a.patch,
          settings: { ...overrides[a.exerciseId]?.settings, ...a.patch.settings },
        }
      return { ...s, overrides }
    }
    case 'machineStack': {
      const machineStacks = { ...s.machineStacks }
      if (a.stack) machineStacks[a.machineId] = a.stack
      else delete machineStacks[a.machineId]
      const machineSteps = { ...s.machineSteps }
      delete machineSteps[a.machineId]
      return { ...s, machineStacks, machineSteps }
    }
    case 'machineStep':
      return { ...s, machineSteps: { ...s.machineSteps, [a.machineId]: a.step } }
    case 'templates':
      return { ...s, templates: a.templates }
    case 'logSets': {
      const day: DayLog = s.logs[a.date] ?? { completed: false, exercises: {} }
      // Взятый сверх рекомендованного вес сразу становится рекомендованным для следующих тренировок
      const list = s.anchors[a.exerciseId] ?? []
      const deload = s.profile ? isDeloadWeek(weekIndex(a.date, s.profile.startDate)) : false
      const over = deload ? null : overWeight(s, a.exerciseId, a.date, a.sets)
      const auto = over ? anchorFromLog(s, a.exerciseId, a.date, a.sets) : null
      const manual = list.find((x) => x.date === a.date && !x.auto)
      const anchors = manual
        ? s.anchors
        : { ...s.anchors, [a.exerciseId]: [...withoutDate(list, a.date), ...(auto ? [{ ...auto, auto: true }] : [])] }
      return {
        ...s,
        anchors,
        logs: { ...s.logs, [a.date]: { ...day, exercises: { ...day.exercises, [a.exerciseId]: a.sets } } },
      }
    }
    case 'complete': {
      const day: DayLog = s.logs[a.date] ?? { completed: false, exercises: {} }
      const anchors = { ...s.anchors }
      const deload = s.profile ? isDeloadWeek(weekIndex(a.date, s.profile.startDate)) : false
      for (const [exId, sets] of Object.entries(day.exercises)) {
        anchors[exId] = withoutDate(anchors[exId], a.date)
        // В разгрузочную неделю веса снижены намеренно — прогрессию по ним не пересчитываем
        const anchor = a.completed && !deload ? anchorFromLog(s, exId, a.date, sets) : null
        if (anchor) anchors[exId] = [...anchors[exId], anchor]
      }
      return { ...s, anchors, logs: { ...s.logs, [a.date]: { ...day, completed: a.completed } } }
    }
    case 'setWeight':
      return {
        ...s,
        anchors: {
          ...s.anchors,
          [a.exerciseId]: [
            ...withoutDate(s.anchors[a.exerciseId], a.date),
            { date: a.date, weight: a.weight, reps: a.reps },
          ],
        },
      }
    case 'extra': {
      const list = (s.extraExercises?.[a.date] ?? []).filter((id) => id !== a.exerciseId)
      return { ...s, extraExercises: { ...s.extraExercises, [a.date]: a.on ? [...list, a.exerciseId] : list } }
    }
    case 'skip': {
      const skipped = { ...s.skipped }
      if (a.on) skipped[a.date] = true
      else delete skipped[a.date]
      return { ...s, skipped }
    }
    case 'templateFor': {
      const templateOverrides = { ...s.templateOverrides }
      if (a.templateId) templateOverrides[a.date] = a.templateId
      else delete templateOverrides[a.date]
      return { ...s, templateOverrides }
    }
    case 'dayOverride': {
      const dayOverrides = { ...s.dayOverrides }
      if (a.on === null) delete dayOverrides[a.date]
      else dayOverrides[a.date] = a.on
      return { ...s, dayOverrides }
    }
    case 'clearWeight':
      return { ...s, anchors: { ...s.anchors, [a.exerciseId]: withoutDate(s.anchors[a.exerciseId], a.date) } }
    case 'lifeGoal': {
      const list = s.lifeGoals ?? []
      const exists = list.some((g) => g.id === a.goal.id)
      return { ...s, lifeGoals: exists ? list.map((g) => (g.id === a.goal.id ? a.goal : g)) : [...list, a.goal] }
    }
    case 'removeLifeGoal':
      return { ...s, lifeGoals: (s.lifeGoals ?? []).filter((g) => g.id !== a.id) }
    case 'groupVisit':
      return { ...s, groupVisits: [...(Array.isArray(s.groupVisits) ? s.groupVisits : []), a.visit] }
    case 'removeGroupVisit':
      return { ...s, groupVisits: (s.groupVisits ?? []).filter((v) => v.id !== a.id) }
    case 'goal':
      return { ...s, goals: [...s.goals.filter((g) => g.exerciseId !== a.goal.exerciseId), a.goal] }
    case 'removeGoal':
      return { ...s, goals: s.goals.filter((g) => g.exerciseId !== a.exerciseId) }
    case 'replace':
      return migrate(withDefaults(a.state))
  }
}

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void; cloud: CloudStatus } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* хранилище недоступно — работаем в памяти */
    }
  }, [state])
  const cloud = useCloudSync(state, (remote) => dispatch({ type: 'replace', state: remote }))
  return <Ctx.Provider value={{ state, dispatch, cloud }}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)!
