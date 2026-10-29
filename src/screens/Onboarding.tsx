import { useStore } from '../store'
import { Brand } from '../components/Brand'
import { ProfileForm, defaultProfile } from './ProfileForm'

export function Onboarding() {
  const { dispatch } = useStore()
  return (
    <div className="stack">
      <header className="header fade-in">
        <Brand />
        <div className="slogan-line">за гранью возможностей</div>
        <h1 className="display" style={{ marginTop: 18 }}>
          Двигайся
          <br />
          <em>осознанно.</em>
        </h1>
        <p className="muted" style={{ maxWidth: 380 }}>
          Расскажи немного о себе: по росту и весу приложение подберёт настройки каждого тренажёра и стартовые веса, а затем
          распишет план по дням на несколько месяцев вперёд.
        </p>
      </header>
      <section className="glass card fade-in">
        <ProfileForm initial={defaultProfile()} submitLabel="Составить план" onSubmit={(profile) => dispatch({ type: 'profile', profile })} />
      </section>
    </div>
  )
}
