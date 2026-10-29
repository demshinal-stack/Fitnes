export type Sex = 'm' | 'f'
export type Experience = 'beginner' | 'intermediate' | 'advanced'

export interface Profile {
  name: string
  heightCm: number
  weightKg: number
  sex: Sex
  experience: Experience
  /** Дни недели: 1 = пн … 7 = вс */
  trainingDays: number[]
  /** ISO-дата начала программы */
  startDate: string
  months: number
}

export interface Machine {
  id: string
  brand: string
  model?: string
  name: string
  photo: string
  /** Шаг грузового стека, кг */
  weightStep: number
  /** Самая лёгкая плита стека, кг */
  minWeight: number
  maxWeight: number
  notes?: string
}

export interface SettingDef {
  key: string
  label: string
  /** Подпись к единице: «позиция», «отверстие», «см» */
  unit: string
  min: number
  max: number
  hint: string
  /** Подписи крайних положений: что значит первое и последнее */
  ends?: [string, string]
  suggest: (p: Profile) => number
}

export interface Exercise {
  id: string
  /** Упражнения пока нет в зале: скрыто из программы и списков */
  unavailable?: boolean
  machineId: string
  name: string
  muscles: string[]
  /** Зона тела для подзаголовка тренировки */
  area: string
  /** Нагрузка сложных движений растёт быстрее */
  compound: boolean
  repMin: number
  repMax: number
  /** Шаг повторов: 2 — только чётные (упражнения на две стороны) */
  repStep?: number
  /** Шаг «популярных» значений для быстрых кнопок выбора повторов */
  quickStep?: number
  /** Упражнение с собственным весом: без стека */
  bodyweight?: boolean
  /** Стартовый рабочий вес в долях от массы тела: новичок / средний / опытный */
  startRatio: [number, number, number]
  /** Поправка на пол для женщин */
  femaleFactor: number
  settings: SettingDef[]
  setup: string[]
  technique: string[]
  mistakes: string[]
}

export interface ExerciseOverride {
  settings?: Record<string, number>
  startWeight?: number
  /** Выбранное пользователем число повторов (нижняя граница диапазона) */
  reps?: number
  sets?: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  exerciseIds: string[]
}

export interface SetLog {
  weight: number
  reps: number
  done: boolean
}

export interface DayLog {
  completed: boolean
  exercises: Record<string, SetLog[]>
  note?: string
}

/** Точка, от которой считается прогрессия упражнения */
export interface Anchor {
  date: string
  weight: number
  reps: number
  /** Поставлен автоматически, когда в подходах взят вес выше рекомендованного */
  auto?: boolean
}

export interface Goal {
  exerciseId: string
  targetWeight: number
  targetReps: number
  targetDate?: string
}

export interface GroupVisit {
  id: string
  classId: string
  date: string
  /** «19:00» */
  time: string
}

/** Цель на будущее: «похудеть», «прокачать попу» или своя формулировка */
export interface LifeGoal {
  id: string
  title: string
  /** Заготовка, от которой взята цель: по ней подбираются упражнения */
  preset?: string
  note?: string
  targetDate?: string
  /** Для «похудеть»: желаемый вес тела */
  targetBodyWeight?: number
  createdAt: string
  done?: boolean
}

export interface StackSpec {
  min: number
  step: number
  max: number
}

export interface AppState {
  version: 1
  profile: Profile | null
  overrides: Record<string, ExerciseOverride>
  /** Шаг стека, если в зале он отличается */
  machineSteps: Record<string, number>
  /** Грузовой стек, сверенный с тренажёром в зале: первая плита, шаг, максимум */
  machineStacks?: Record<string, StackSpec>
  /** Посещённые групповые занятия */
  groupVisits?: GroupVisit[]
  lifeGoals?: LifeGoal[]
  templates: WorkoutTemplate[]
  logs: Record<string, DayLog>
  anchors: Record<string, Anchor[]>
  goals: Goal[]
  /** Упражнения, о которых пользователь уже знает: новые из обновлений добавляются в программу один раз */
  knownExercises: string[]
  templatesVersion: number
  /** Ручная правка календаря: true — тренировка, false — отдых */
  dayOverrides: Record<string, boolean>
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  reps: number
  weight: number
  deload: boolean
}

export interface PlannedDay {
  date: string
  template: WorkoutTemplate
  week: number
  deload: boolean
  exercises: PlannedExercise[]
}
