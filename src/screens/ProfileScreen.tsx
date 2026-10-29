import { useRef, useState } from 'react'
import { Section } from '../components/ui'
import { EXERCISES, exerciseById } from '../data/machines'
import { todayISO } from '../lib/date'
import { emptyState, useStore } from '../store'
import type { AppState } from '../types'
import { ProfileForm } from './ProfileForm'

const CLOUD_TEXT = {
  loading: 'Проверяю сохранение в аккаунте…',
  saving: 'Сохраняю в аккаунт…',
  saved: '✓ Прогресс сохраняется в твой аккаунт Claude автоматически и одинаковый в Safari и в приложении Claude. Раз в день сохраняется ещё и копия на этот день.',
  error: 'Сейчас не получилось сохранить в аккаунт, попробую при следующем изменении. Данные пока хранятся на этом телефоне.',
  off: 'Здесь сохранение в аккаунт недоступно: данные хранятся только на этом телефоне. Сохраняй копию время от времени.',
} as const

export function ProfileScreen() {
  const { state, dispatch, cloud } = useStore()
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    const json = JSON.stringify(state, null, 2)
    const filename = `forma-backup-${todayISO()}.json`
    // Внутри claude.ai файл отдаётся через возможность downloads, в самостоятельном PWA — обычной ссылкой
    const claude = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: string }) => Promise<unknown> } | null> } }).claude
    const downloads = claude ? await claude.use('downloads').catch(() => null) : null
    if (downloads) {
      try {
        await downloads.save({ filename, data: json })
        setMessage('Копия сохранена')
      } catch (e) {
        if ((e as { code?: string }).code !== 'declined') setMessage('Сохранить файл здесь не получилось')
      }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as AppState
      if (data.version !== 1) throw new Error('version')
      dispatch({ type: 'replace', state: data })
      setMessage('Данные восстановлены из копии')
    } catch {
      setMessage('Не удалось прочитать файл: выбери JSON-копию, сохранённую из Jaylle fitness')
    }
  }

  const toggle = (tid: string, exId: string) =>
    dispatch({
      type: 'templates',
      templates: state.templates.map((t) =>
        t.id !== tid ? t : { ...t, exerciseIds: t.exerciseIds.includes(exId) ? t.exerciseIds.filter((x) => x !== exId) : [...t.exerciseIds, exId] },
      ),
    })

  return (
    <div className="stack">
      <header className="header fade-in">
        <div className="eyebrow">Параметры · Программа · Данные</div>
        <h1 className="display">Профиль</h1>
      </header>

      <Section eyebrow="Обо мне" title="Параметры">
        <ProfileForm
          initial={state.profile!}
          submitLabel={saved ? 'Сохранено' : 'Сохранить'}
          onSubmit={(profile) => {
            dispatch({ type: 'profile', profile })
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          }}
        />
        <p className="muted small" style={{ margin: 0 }}>
          Настройки тренажёров, которые ты не менял вручную, пересчитаются по новым росту и весу.
        </p>
      </Section>

      <Section eyebrow="Программа" title="Состав тренировок">
        <p className="muted small" style={{ margin: 0 }}>
          Тренировки чередуются по дням: {state.templates.map((t) => t.id).join(' → ')}. Салатовые с ✓ — уже в тренировке, тусклые с «+» — можно добавить.
          Метка A/B — упражнение уже есть в другой тренировке: его можно взять повторно, но лучше не дублировать.
        </p>
        {state.templates.map((t) => (
          <div key={t.id} className="stack" style={{ gap: 8 }}>
            <div className="title" style={{ fontSize: 20 }}>
              {t.name}
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {[...EXERCISES].sort((x, y) => Number(t.exerciseIds.includes(y.id)) - Number(t.exerciseIds.includes(x.id))).map((e) => {
                const elsewhere = state.templates.filter((o) => o.id !== t.id && o.exerciseIds.includes(e.id)).map((o) => o.id)
                const on = t.exerciseIds.includes(e.id)
                return (
                  <button key={e.id} className={`chip ${on ? 'pick-on' : 'pick-off'}`} aria-pressed={on} onClick={() => toggle(t.id, e.id)}>
                    <span className="pick-mark">{on ? '✓' : '+'}</span>
                    {exerciseById(e.id).name}
                    {elsewhere.length > 0 && <span className="tag">{elsewhere.join(', ')}</span>}
                  </button>
                )
              })}
            </div>
            {(() => {
              const dup = t.exerciseIds.filter((id) => state.templates.some((o) => o.id !== t.id && o.exerciseIds.includes(id)))
              return dup.length > 0 ? (
                <p className="small" style={{ margin: 0, color: 'var(--blue)' }}>
                  Повторяются в другой тренировке: {dup.map((id) => exerciseById(id).name).join(', ')}. Так можно, но мышцам лучше дать отдых между днями.
                </p>
              ) : null
            })()}
            <hr className="thin" />
          </div>
        ))}
      </Section>

      <Section eyebrow="Данные" title="Резервная копия">
        <p className="muted small" style={{ margin: 0 }}>
          {CLOUD_TEXT[cloud]}
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={exportData}>
            Сохранить копию
          </button>
          <button className="btn ghost sm" onClick={() => file.current?.click()}>
            Восстановить
          </button>
          {confirmReset ? (
            <button className="btn sm" onClick={() => dispatch({ type: 'replace', state: emptyState() })}>
              Да, удалить всё
            </button>
          ) : (
            <button className="btn ghost sm" onClick={() => setConfirmReset(true)}>
              Сбросить всё
            </button>
          )}
        </div>
        {message && <p className="small wine" style={{ margin: 0 }}>{message}</p>}
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </Section>
    </div>
  )
}
