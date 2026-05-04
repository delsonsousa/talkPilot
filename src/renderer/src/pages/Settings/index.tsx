import { useState } from 'react'
import { Cpu, Mic, Keyboard, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import ModelsTab from './tabs/Models'
import AudioTab from './tabs/Audio'
import HotkeysTab from './tabs/Hotkeys'
import PrivacyTab from './tabs/Privacy'

type TabId = 'models' | 'audio' | 'hotkeys' | 'privacy'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'hotkeys', label: 'Hotkeys', icon: Keyboard },
  { id: 'privacy', label: 'Privacy', icon: Shield }
]

export default function SettingsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('models')

  const ActiveContent = {
    models: ModelsTab,
    audio: AudioTab,
    hotkeys: HotkeysTab,
    privacy: PrivacyTab
  }[activeTab]

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Title bar — substitui a barra nativa do macOS */}
      <div
        className="shrink-0 flex items-center justify-center border-b border-border"
        style={{ height: 38, WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <TalkPilotLogo />
      </div>

      {/* Corpo: sidebar + conteúdo */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-48 shrink-0 border-r border-border flex flex-col pt-4 pb-4 px-3 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors w-full text-left',
                activeTab === id
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <ActiveContent />
        </main>
      </div>
    </div>
  )
}

function TalkPilotLogo(): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <svg width="16" height="20" viewBox="0 0 30 40" aria-hidden="true" className="shrink-0">
        <rect x="0"  y="15" width="8" height="25" rx="4" fill="#00F0A8" />
        <rect x="11" y="0"  width="8" height="40" rx="4" fill="#00F0A8" />
        <rect x="22" y="8"  width="8" height="32" rx="4" fill="#00F0A8" />
      </svg>
      <span className="text-[13px] font-semibold leading-none text-foreground">TalkPilot</span>
    </div>
  )
}
