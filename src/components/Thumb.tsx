import { useState } from 'react'
import { exerciseById, machineById } from '../data/machines'
import { thumbSrc } from '../lib/assets'

/** Миниатюра упражнения: векторный рисунок из ветки анимаций, пока его нет — рисунок или фото тренажёра */
export function Thumb({ exerciseId, className }: { exerciseId: string; className: string }) {
  // миниатюра оборудования → кадр анимации → фото тренажёра
  const [stage, setStage] = useState(0)
  const machine = machineById(exerciseById(exerciseId).machineId)
  return (
    <img
      className={`${className} vec`}
      src={[thumbSrc(exerciseId) ?? `animations/thumb/${exerciseId}.svg`, `animations/${exerciseId}.svg`, machine.photo][stage]}
      alt=""
      onError={() => stage < 2 && setStage(stage + 1)}
    />
  )
}
