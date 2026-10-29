/** Цели «на будущее» и упражнения программы, которые на них работают */
export interface GoalPreset {
  id: string
  title: string
  /** Короткая подсказка, что делать помимо зала */
  tip: string
  exercises: string[]
  /** Для цели по весу тела показываем путь к желаемому весу */
  bodyWeight?: boolean
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: 'lose',
    title: 'Похудеть',
    tip: 'Главное — регулярность: 2–3 тренировки в неделю, шаги каждый день и небольшой дефицит калорий.',
    exercises: ['lat-pulldown', 'seated-cable-row', 'chest-press', 'seated-leg-curl', 'lying-leg-curl', 'hip-abduction', 'hip-adduction', 'reclined-hip-abduction', 'dumbbell-shoulder-press'],
    bodyWeight: true,
  },
  {
    id: 'glutes',
    title: 'Прокачать попу',
    tip: 'Ягодицы любят прогрессию веса и паузу в верхней точке. Не торопи опускание.',
    exercises: ['hip-abduction', 'reclined-hip-abduction', 'lying-leg-curl', 'seated-leg-curl', 'hip-adduction'],
  },
  {
    id: 'back',
    title: 'Сильная спина',
    tip: 'Тянем лопатками, а не руками: сначала свести и опустить лопатки, потом сгибать локти.',
    exercises: ['lat-pulldown', 'seated-cable-row', 'dumbbell-shoulder-press', 'dead-bug'],
  },
  {
    id: 'posture',
    title: 'Ровная осанка',
    tip: 'Тяги укрепляют спину, мёртвый жук — глубокий корпус. В течение дня проверяй: плечи вниз, макушка вверх.',
    exercises: ['seated-cable-row', 'lat-pulldown', 'dead-bug', 'ball-crunch', 'chest-press'],
  },
  {
    id: 'belly',
    title: 'Убрать живот',
    tip: 'Пресс делает живот плотнее, а уходит он вместе с общим похудением. Дыхание и подкручивание таза важнее количества.',
    exercises: ['dead-bug', 'ball-crunch'],
  },
  {
    id: 'arms',
    title: 'Подтянуть руки',
    tip: 'Трицепс отвечает за заднюю поверхность руки — ту, что «висит». Плечи дают красивую линию.',
    exercises: ['cable-triceps-pushdown', 'dumbbell-shoulder-press', 'dumbbell-front-raise', 'chest-press'],
  },
  {
    id: 'legs',
    title: 'Стройные ноги',
    tip: 'Внутренняя и задняя поверхность бедра + регулярные шаги. Амплитуда полная, без рывков.',
    exercises: ['hip-adduction', 'hip-abduction', 'reclined-hip-abduction', 'seated-leg-curl', 'lying-leg-curl'],
  },
]

export const presetById = (id?: string) => GOAL_PRESETS.find((g) => g.id === id)
