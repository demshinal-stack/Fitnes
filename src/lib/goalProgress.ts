import type { GoalModel } from '../data/goalModels'
import type { AppState } from '../types'
import { addDays, todayISO } from './date'
import { plannedDays, programEnd } from './plan'

/** Ожидаемый эффект после n тренировок */
export const effectAfter = (m: GoalModel, n: number, boosted: boolean) => {
  const max = m.max * (boosted && m.boost ? m.boost : 1)
  return max * (1 - Math.exp(-n / m.tau))
}

/** Сколько тренировок нужно до цели; Infinity — за пределом реального */
export const sessionsFor = (m: GoalModel, target: number, boosted: boolean) => {
  const max = m.max * (boosted && m.boost ? m.boost : 1)
  if (target >= max * 0.97) return Infinity
  return -m.tau * Math.log(1 - target / max)
}

const doneSets = (state: AppState, date: string, ids: string[]) =>
  ids.reduce((n, id) => n + (state.logs[date]?.exercises[id] ?? []).filter((s) => s.done).length, 0)

/** Тренировки, в которых работали упражнения цели: с отмеченными подходами или завершённые по плану */
export const goalSessions = (state: AppState, ids: string[]) => {
  const p = state.profile
  if (!p) return 0
  const planned = new Map(plannedDays(state, '0000-01-01', todayISO()).map((d) => [d.date, d]))
  let n = 0
  for (const [date, log] of Object.entries(state.logs)) {
    if (date > todayISO()) continue
    if (doneSets(state, date, ids) > 0) n++
    else if (log.completed && planned.get(date)?.exercises.some((e) => ids.includes(e.exerciseId))) n++
  }
  return n
}

/** Сколько тренировок с упражнениями цели в неделю по текущему расписанию */
export const goalRate = (state: AppState, ids: string[]) => {
  const p = state.profile
  if (!p || state.templates.length === 0) return 0
  const share = state.templates.filter((t) => t.exerciseIds.some((id) => ids.includes(id))).length / state.templates.length
  return p.trainingDays.length * share
}

/** Дата, к которой цель скорее всего будет достигнута по текущему графику */
export const etaDate = (m: GoalModel, target: number, boosted: boolean, n: number, rate: number) => {
  const need = sessionsFor(m, target, boosted)
  if (!isFinite(need)) return undefined
  if (need <= n) return todayISO()
  if (rate <= 0) return undefined
  return addDays(todayISO(), Math.ceil(((need - n) / rate) * 7))
}

/** Рост рабочих весов в упражнениях цели: первый записанный вес → последний, в среднем по упражнениям */
export const strengthGain = (state: AppState, ids: string[]) => {
  const gains: number[] = []
  const dates = Object.keys(state.logs).sort()
  for (const id of ids) {
    const ws = dates.flatMap((d) => (state.logs[d].exercises[id] ?? []).filter((s) => s.done && s.weight > 0).map((s) => s.weight))
    if (ws.length >= 2 && ws[0] > 0) gains.push((Math.max(...ws.slice(-3)) - ws[0]) / ws[0])
  }
  return gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : undefined
}

/** Конец программы: для подсказки «к концу программы» */
export const programEndOf = (state: AppState) => (state.profile ? programEnd(state.profile) : undefined)
