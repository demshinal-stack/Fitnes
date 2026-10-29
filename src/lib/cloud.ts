import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../types'

/**
 * Сохранение прогресса в аккаунт Claude (возможность db артефакта).
 * Локальная копия в localStorage остаётся основной для мгновенной работы,
 * а облачная — источник правды между Safari, приложением Claude и другими устройствами.
 * Данные лежат в личном разделе data/users/<id>/ (state и backup-<дата>), его не видит никто, кроме пользователя.
 */

type Snap = { exists: boolean; data(): Record<string, unknown> | undefined }
type DocRef = { get(): Promise<Snap>; set(d: Record<string, unknown>): Promise<void> }
type Db = { doc(path: string): DocRef }
type User = { id(): Promise<string | null> }
type Claude = { use(name: string): Promise<unknown> }

export type CloudStatus = 'off' | 'loading' | 'saving' | 'saved' | 'error'

const TS_KEY = 'gym-diary/v1:ts'
const localTs = () => {
  try {
    return Number(localStorage.getItem(TS_KEY) ?? 0)
  } catch {
    return 0
  }
}
const setLocalTs = (t: number) => {
  try {
    localStorage.setItem(TS_KEY, String(t))
  } catch {
    /* приватный режим */
  }
}

async function connect(): Promise<{ main: DocRef; daily: (date: string) => DocRef } | null> {
  const claude = (window as unknown as { claude?: Claude }).claude
  if (!claude) return null
  const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [Db | null, User | null]
  const uid = db && user ? await user.id() : null
  if (!db || !uid) return null
  const base = `data/users/${uid}`
  // Путь документа — чётное число сегментов: data/users/<id>/<doc>
  return { main: db.doc(`${base}/state`), daily: (date) => db.doc(`${base}/backup-${date}`) }
}

/** Подтягивает более свежую облачную копию и сохраняет каждое изменение с задержкой */
export function useCloudSync(state: AppState, replace: (s: AppState) => void): CloudStatus {
  const [status, setStatus] = useState<CloudStatus>('loading')
  const conn = useRef<Awaited<ReturnType<typeof connect>>>(null)
  const ready = useRef(false)
  const skipNext = useRef(false)
  const first = useRef(true)
  const stateRef = useRef(state)
  stateRef.current = state

  // Сравнить с облаком: при открытии и при возвращении в приложение
  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        conn.current ??= await connect()
        const c = conn.current
        if (!c) return alive && setStatus('off')
        const snap = await c.main.get()
        const remote = snap.exists ? (snap.data() as { json?: string; updatedAt?: number }) : undefined
        const local = stateRef.current
        if (remote?.json && (remote.updatedAt ?? 0) > localTs() || (remote?.json && !local.profile)) {
          skipNext.current = true
          setLocalTs(remote!.updatedAt ?? Date.now())
          replace(JSON.parse(remote!.json!) as AppState)
        } else if (local.profile && (!remote || localTs() > (remote.updatedAt ?? 0))) {
          await push(local, localTs() || Date.now())
        }
        ready.current = true
        if (alive) setStatus('saved')
      } catch {
        if (!alive) return
        setStatus('error')
        // Повторить позже: сеть или разрешение могли появиться
        setTimeout(() => alive && !ready.current && pull(), 8000)
      }
    }
    pull()
    const onVisible = () => document.visibilityState === 'visible' && pull()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const push = async (s: AppState, t: number) => {
    const c = conn.current
    if (!c || !s.profile) return
    const json = JSON.stringify(s)
    await c.main.set({ json, updatedAt: t })
    // Ежедневный снимок: если что-то случайно сбросить, можно вернуться к вчерашнему дню
    await c.daily(new Date(t).toISOString().slice(0, 10)).set({ json, updatedAt: t })
  }

  // Каждое изменение: отметить время и через 1.5 с отправить в облако
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    const t = Date.now()
    setLocalTs(t)
    if (!ready.current) return
    setStatus('saving')
    const timer = setTimeout(() => {
      push(state, t).then(
        () => setStatus('saved'),
        () => setStatus('error'),
      )
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return status
}
