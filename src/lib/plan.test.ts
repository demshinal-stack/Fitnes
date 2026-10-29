import { describe, expect, it } from 'vitest'
import { emptyState, migrate, reducer } from '../store'
import type { AppState } from '../types'
import { copiedSets, isDeloadWeek, planExercise, plannedDays, projectGoal, suggestStartWeight } from './plan'
import { exerciseById } from '../data/machines'
import { quickNeighbors } from '../components/NumberPicker'

const base = (): AppState => ({
  ...emptyState(),
  profile: {
    name: 'Тест',
    heightCm: 180,
    weightKg: 80,
    sex: 'm',
    experience: 'intermediate',
    trainingDays: [1, 3, 5],
    startDate: '2026-11-02',
    months: 3,
  },
})

describe('план', () => {
  it('стартовый вес кратен шагу стека', () => {
    expect(suggestStartWeight(exerciseById('seated-cable-row'), base().profile!, 5)).toBe(50)
  })

  it('расписание чередует A и B по дням тренировок', () => {
    const days = plannedDays(base(), '2026-11-02', '2026-11-08')
    expect(days.map((d) => [d.date, d.template.id])).toEqual([
      ['2026-11-02', 'A'],
      ['2026-11-04', 'B'],
      ['2026-11-06', 'A'],
    ])
  })

  it('по умолчанию 3 × 15, вес растёт на шаг раз в две недели; разгрузок со снижением нет', () => {
    const s = base()
    const w = (d: string) => planExercise(s, 'seated-cable-row', d)
    expect(w('2026-11-02')).toMatchObject({ weight: 50, reps: 15, sets: 3 })
    expect(w('2026-11-09')).toMatchObject({ weight: 50, reps: 15 })
    expect(isDeloadWeek(3)).toBe(false)
    expect(w('2026-11-16')).toMatchObject({ weight: 55, reps: 15, sets: 3 })
    expect(w('2026-11-23')).toMatchObject({ deload: false, weight: 55, reps: 15 })
    expect(w('2026-11-30')).toMatchObject({ weight: 60, reps: 15 })
    // вес по плану никогда не снижается
    let prev = 0
    for (let d = new Date(2026, 10, 2); d < new Date(2027, 2, 1); d.setDate(d.getDate() + 7)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expect(w(iso).weight).toBeGreaterThanOrEqual(prev)
      prev = w(iso).weight
    }
  })

  it('недовыполнение снижает план, завершение пересчитывает прогрессию', () => {
    let s = base()
    s = reducer(s, {
      type: 'logSets',
      date: '2026-11-09',
      exerciseId: 'seated-cable-row',
      sets: [
        { weight: 50, reps: 6, done: true },
        { weight: 50, reps: 5, done: true },
      ],
    })
    s = reducer(s, { type: 'complete', date: '2026-11-09', completed: true })
    expect(planExercise(s, 'seated-cable-row', '2026-11-11')).toMatchObject({ weight: 45, reps: 15 })
    expect(planExercise(s, 'seated-cable-row', '2026-11-23')).toMatchObject({ weight: 50, reps: 15 })
    s = reducer(s, { type: 'complete', date: '2026-11-09', completed: false })
    expect(planExercise(s, 'seated-cable-row', '2026-11-16')).toMatchObject({ weight: 55, reps: 15 })
  })

  it('выбранные повторы и подходы задают план', () => {
    let s = base()
    s = reducer(s, { type: 'override', exerciseId: 'seated-cable-row', patch: { reps: 8, sets: 5 } })
    expect(planExercise(s, 'seated-cable-row', '2026-11-02')).toMatchObject({ reps: 8, sets: 5 })
  })

  it('мёртвый жук: свой вес, только чётные повторы, +2 в неделю', () => {
    const s = base()
    expect(planExercise(s, 'dead-bug', '2026-11-02')).toMatchObject({ weight: 0, reps: 16, sets: 3 })
    expect(planExercise(s, 'dead-bug', '2026-11-09')).toMatchObject({ weight: 0, reps: 18 })
  })

  it('быстрые кнопки повторов', () => {
    expect(quickNeighbors(12, 5, 1, 1, 100)).toEqual({ left: 10, right: 15 })
    expect(quickNeighbors(15, 5, 1, 1, 100)).toEqual({ left: 10, right: 20 })
    expect(quickNeighbors(20, 4, 2, 2, 100)).toEqual({ left: 16, right: 24 })
    expect(quickNeighbors(3, 1, 1, 1, 10)).toEqual({ left: 2, right: 4 })
  })

  it('прогноз цели находит дату', () => {
    expect(projectGoal(base(), { exerciseId: 'seated-cable-row', targetWeight: 55, targetReps: 15 })).toBe('2026-11-16')
    expect(projectGoal(base(), { exerciseId: 'seated-cable-row', targetWeight: 150, targetReps: 8 })).toBeNull()
  })
})

describe('обновления', () => {
  it('новое упражнение добавляется в старые тренировки один раз', () => {
    const old = { ...base(), knownExercises: ['seated-cable-row'], templates: [{ id: 'A', name: 'A', exerciseIds: ['seated-cable-row'] }] }
    const m = migrate(old)
    expect(m.templates[0].exerciseIds).toContain('dead-bug')
    const removed = { ...m, templates: [{ ...m.templates[0], exerciseIds: ['seated-cable-row'] }] }
    expect(migrate(removed).templates[0].exerciseIds).toEqual(['seated-cable-row'])
  })
})

describe('календарь', () => {
  it('отмеченный прошлый день становится тренировкой; первая тренировка программы остаётся A, прошлые чередуются назад', () => {
    let s = base()
    s = reducer(s, { type: 'dayOverride', date: '2026-10-30', on: true })
    s = reducer(s, { type: 'dayOverride', date: '2026-11-04', on: false })
    const days = plannedDays(s, '2026-10-01', '2026-11-08').map((d) => [d.date, d.template.id])
    expect(days).toEqual([
      ['2026-10-30', 'B'],
      ['2026-11-02', 'A'],
      ['2026-11-06', 'B'],
    ])
  })

  it('прошлая отмеченная тренировка без записей повторяет веса ближайшей такой же', () => {
    let s = base()
    s = reducer(s, { type: 'dayOverride', date: '2026-10-28', on: true })
    s = reducer(s, { type: 'complete', date: '2026-10-28', completed: true })
    const sets = [{ weight: 55, reps: 12, done: true }, { weight: 55, reps: 12, done: true }]
    s = reducer(s, { type: 'logSets', date: '2026-11-02', exerciseId: 'seated-cable-row', sets })
    expect(plannedDays(s, '2026-10-01', '2026-10-31').map((d) => d.template.id)).toEqual(['B'])
    // 28.10 — это B, а тяга в A, поэтому копировать нечего
    expect(copiedSets(s, '2026-10-28', 'seated-cable-row')).toBeUndefined()
    s = reducer(s, { type: 'dayOverride', date: '2026-10-26', on: true })
    s = reducer(s, { type: 'complete', date: '2026-10-26', completed: true })
    expect(copiedSets(s, '2026-10-26', 'seated-cable-row')).toEqual(sets)
  })
})
