import { TabBar } from './components/TabBar'
import { ConfettiBackground, Splash } from './components/Brand'
import { useRoute } from './components/ui'
import { isAvailable } from './data/machines'
import { CalendarScreen } from './screens/CalendarScreen'
import { DayScreen } from './screens/DayScreen'
import { ExerciseScreen } from './screens/ExerciseScreen'
import { GoalsScreen } from './screens/GoalsScreen'
import { MachinesScreen } from './screens/MachinesScreen'
import { Onboarding } from './screens/Onboarding'
import { ProfileScreen } from './screens/ProfileScreen'
import { useStore } from './store'

export default function App() {
  const { state } = useStore()
  const [page, arg] = useRoute()

  if (!state.profile)
    return (
      <>
        <ConfettiBackground />
        <main className="app">
          <Onboarding />
        </main>
        <Splash />
      </>
    )

  let screen
  let tab = ''
  if (page === 'day' && arg) screen = <DayScreen date={arg} />
  else if (page === 'plan') {
    screen = <CalendarScreen />
    tab = 'plan'
  }
  else if (page === 'ex' && arg && isAvailable(arg)) {
    screen = <ExerciseScreen key={arg} id={arg} />
    tab = 'machines'
  } else if (page === 'machines') {
    screen = <MachinesScreen />
    tab = 'machines'
  } else if (page === 'goals') {
    screen = <GoalsScreen />
    tab = 'goals'
  } else if (page === 'profile') {
    screen = <ProfileScreen />
    tab = 'profile'
  } else screen = <DayScreen />

  return (
    <>
      <ConfettiBackground />
      <main className="app">{screen}</main>
      <TabBar active={tab} canBack={!!arg} />
      <Splash />
    </>
  )
}
