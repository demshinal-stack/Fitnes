import { navigate } from '../components/ui'
import { EXERCISES, MACHINES } from '../data/machines'
import { Thumb } from '../components/Thumb'

export function MachinesScreen() {
  return (
    <div className="stack">
      <header className="header fade-in">
        <div className="eyebrow">Твой зал · {MACHINES.length} тренажёров</div>
        <h1 className="display">
          Тренажёры
          <br />
          <em>и техника.</em>
        </h1>
      </header>
      {MACHINES.map((m) => {
        const exercises = EXERCISES.filter((e) => e.machineId === m.id)
        return (
          <section key={m.id} className="glass machine-card fade-in">
            <button className="machine-frame" aria-label={`Открыть: ${m.name}`} onClick={() => navigate(`/ex/${exercises[0].id}`)}>
              <Thumb className="machine-img" exerciseId={exercises[0].id} />
            </button>
            <div className="machine-info">
              <div className="eyebrow">
                {m.brand}
                {m.model ? ` · ${m.model}` : ''}
              </div>
              <h2 className="title">{m.name}</h2>
              {exercises.map((e) => (
                <button key={e.id} className="machine-ex" onClick={() => navigate(`/ex/${e.id}`)}>
                  <span>{e.name}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
