import { useEffect, useRef, useState } from 'react'
import { exerciseById, machineById } from '../data/machines'
import '../vendor/gym-machines/machines.css'
import '../vendor/gym-machines/machines.js'

export interface MachineValue {
  weight: number
  back?: number
  start?: number
}

interface Handle {
  update: (o: { user?: { height: number; mass: number }; value?: MachineValue; rec?: MachineValue; weights?: number[] }) => void
  destroy: () => void
}

declare global {
  interface Window {
    GymMachines?: {
      ids: string[]
      mount: (
        el: HTMLElement,
        id: string,
        opts: {
          user: { height: number; mass: number }
          value: MachineValue
          rec?: MachineValue
          weights?: number[]
          onPick?: (part: string) => void
        },
      ) => Handle
    }
  }
}

/**
 * Анимация упражнения из потока анимаций.
 * Интерактивная версия (machines.js): тап по стеку, спинке или колесу вызывает onPick.
 * Если интерактивной нет — статичный animations/<id>.svg, если нет и его — фото тренажёра.
 */
export function ExerciseAnimation({
  exerciseId,
  user,
  value,
  rec,
  weights,
  onPick,
}: {
  exerciseId: string
  user: { height: number; mass: number }
  value: MachineValue
  rec: MachineValue
  weights: number[]
  onPick?: (part: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const handle = useRef<Handle | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const [missing, setMissing] = useState(false)
  const interactive = !!window.GymMachines?.ids.includes(exerciseId)

  useEffect(() => {
    if (!interactive || !box.current) return
    handle.current = window.GymMachines!.mount(box.current, exerciseId, {
      user,
      value,
      rec,
      weights,
      onPick: (part) => pick.current?.(part),
    })
    return () => {
      handle.current?.destroy()
      handle.current = null
    }
    // Монтируем один раз на упражнение, дальше только update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, interactive])

  useEffect(() => {
    handle.current?.update({ user, value, rec, weights })
  }, [user, value, rec, weights])

  const ex = exerciseById(exerciseId)
  const machine = machineById(ex.machineId)
  if (interactive)
    return (
      <div className="anim glass">
        <div
          ref={box}
          className="anim-live"
          onClick={(e) => {
            // Тап по грузовому стеку или подписи веса — к выбору веса
            const t = e.target as Element
            if (!t.closest('[data-part]') && /\b(plate|frame|lbl|lbl-bg|rod|pin)\b/.test(t.getAttribute('class') ?? '')) pick.current?.('weight')
          }}
        />
      </div>
    )
  return (
    <div className="anim glass">
      {missing ? (
        <>
          <img className="photo" src={machine.photo} alt={machine.name} />
          <span className="chip badge">Анимация упражнения скоро появится</span>
        </>
      ) : (
        <img src={`animations/${exerciseId}.svg`} alt={`Как выполнять: ${ex.name}`} onError={() => setMissing(true)} />
      )}
    </div>
  )
}
