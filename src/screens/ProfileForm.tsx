import { useState } from 'react'
import { Wheel } from '../components/Wheel'
import { WEEKDAYS_SHORT, mondayOf, addDays, todayISO } from '../lib/date'
import type { Experience, Profile, Sex } from '../types'

export const defaultProfile = (): Profile => ({
  name: '',
  heightCm: 180,
  weightKg: 80,
  sex: 'm',
  experience: 'beginner',
  trainingDays: [1, 3, 5],
  startDate: addDays(mondayOf(todayISO()), 7),
  months: 3,
})

const EXP: [Experience, string][] = [
  ['beginner', 'Новичок'],
  ['intermediate', 'Средний'],
  ['advanced', 'Опытный'],
]

export function ProfileForm({ initial, submitLabel, onSubmit }: { initial: Profile; submitLabel: string; onSubmit: (p: Profile) => void }) {
  const [p, setP] = useState(initial)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }))
  const toggleDay = (d: number) =>
    set('trainingDays', p.trainingDays.includes(d) ? p.trainingDays.filter((x) => x !== d) : [...p.trainingDays, d].sort())
  const valid = p.heightCm >= 120 && p.heightCm <= 230 && p.weightKg >= 35 && p.weightKg <= 250 && p.trainingDays.length > 0

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(p)
      }}
    >
      <label className="field">
        <span className="eyebrow">Имя</span>
        <input className="input" value={p.name} placeholder="Как к тебе обращаться" onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid2">
        <div className="field">
          <span className="eyebrow">Рост, см</span>
          <Wheel label="Рост, см" value={p.heightCm} min={120} max={230} onChange={(v) => set('heightCm', v)} />
        </div>
        <div className="field">
          <span className="eyebrow">Вес, кг</span>
          <Wheel
            label="Вес, кг"
            value={p.weightKg}
            min={35}
            max={200}
            step={0.5}
            format={(v) => String(v).replace('.', ',')}
            onChange={(v) => set('weightKg', v)}
          />
        </div>
      </div>
      <div className="field stack" style={{ gap: 6 }}>
        <span className="eyebrow">Пол</span>
        <div className="seg">
          {(
            [
              ['m', 'Мужской'],
              ['f', 'Женский'],
            ] as [Sex, string][]
          ).map(([v, l]) => (
            <button type="button" key={v} className={p.sex === v ? 'on' : ''} onClick={() => set('sex', v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field stack" style={{ gap: 6 }}>
        <span className="eyebrow">Опыт в зале</span>
        <div className="seg">
          {EXP.map(([v, l]) => (
            <button type="button" key={v} className={p.experience === v ? 'on' : ''} onClick={() => set('experience', v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="field stack" style={{ gap: 6 }}>
        <span className="eyebrow">Дни тренировок</span>
        <div className="days">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button type="button" key={d} className={p.trainingDays.includes(i + 1) ? 'on' : ''} onClick={() => toggleDay(i + 1)}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <label className="field">
          <span className="eyebrow">Старт программы</span>
          <input className="input" type="date" value={p.startDate} onChange={(e) => e.target.value && set('startDate', e.target.value)} />
        </label>
        <label className="field">
          <span className="eyebrow">Срок, мес.</span>
          <select className="input" value={p.months} onChange={(e) => set('months', Number(e.target.value))}>
            {[1, 2, 3, 4, 6].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn block" disabled={!valid} style={{ marginTop: 8, opacity: valid ? 1 : 0.5 }}>
        {submitLabel}
      </button>
    </form>
  )
}
