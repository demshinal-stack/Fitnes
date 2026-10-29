/** Групповые занятия клуба, на которые можно ходить. Расписания нет: посещение отмечается датой и временем */
export interface GroupClass {
  id: string
  /** Направление: «Качай!», «Сияй!» */
  brand: string
  name: string
  minutes: number
}

export const GROUP_CLASSES: GroupClass[] = [
  { id: 'kachay-posture-abs', brand: 'Качай!', name: 'Осанка + пресс', minutes: 45 },
  { id: 'siyay-stretch', brand: 'Сияй!', name: 'Растяжка', minutes: 55 },
  { id: 'siyay-pilates', brand: 'Сияй!', name: 'Пилатес', minutes: 45 },
]

export const groupById = (id: string) => GROUP_CLASSES.find((g) => g.id === id)
