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
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-border flex flex-col pt-6 pb-4 px-3 gap-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          TalkPilot
        </p>
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <ActiveContent />
      </main>
    </div>
  )
}
