const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export const addDays = (iso: string, days: number) => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const addMonths = (iso: string, months: number) => {
  const d = parseISO(iso)
  d.setMonth(d.getMonth() + months)
  return toISO(d)
}

/** 1 = понедельник … 7 = воскресенье */
export const weekday = (iso: string) => {
  const w = parseISO(iso).getDay()
  return w === 0 ? 7 : w
}

export const mondayOf = (iso: string) => addDays(iso, 1 - weekday(iso))

export const diffDays = (a: string, b: string) =>
  Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000)

export const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']

export const formatDay = (iso: string) => {
  const d = parseISO(iso)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
}

export const formatDayLong = (iso: string) => {
  const w = WEEKDAYS[weekday(iso) - 1]
  return `${w[0].toUpperCase()}${w.slice(1)}, ${formatDay(iso)}`
}
