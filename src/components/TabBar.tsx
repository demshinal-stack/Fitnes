import { navigate } from './ui'

const TABS = [
  { id: '', label: 'Сегодня', icon: <path d="M4 11l8-6 8 6v9h-5v-6H9v6H4z" /> },
  { id: 'plan', label: 'План', icon: <path d="M4 7h16M4 7v12h16V7M4 7V5h16v2M8 3v4M16 3v4M8 12h2M14 12h2M8 16h2" /> },
  { id: 'machines', label: 'Тренажёры', icon: <path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /> },
  { id: 'goals', label: 'Цели', icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" /></> },
  { id: 'profile', label: 'Профиль', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></> },
]

export function TabBar({ active, canBack }: { active: string; canBack: boolean }) {
  return (
    <nav className="tabbar glass">
      {canBack && (
        <button className="tab tab-back" aria-label="Назад" onClick={() => (history.length > 1 ? history.back() : navigate('/'))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {TABS.map((t) => (
        <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => navigate('/' + t.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {t.icon}
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
