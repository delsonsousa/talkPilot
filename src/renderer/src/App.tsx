import DockPage from './pages/Dock'
import OverlayPage from './pages/Overlay'
import SettingsPage from './pages/Settings'
import SuggestionsPage from './pages/Suggestions'

const windowParam = new URLSearchParams(window.location.search).get('window')

export default function App(): JSX.Element {
  if (windowParam === 'settings') return <SettingsPage />
  if (windowParam === 'suggestions') return <SuggestionsPage />
  if (windowParam === 'transcript') return <OverlayPage />
  return <DockPage />
}
