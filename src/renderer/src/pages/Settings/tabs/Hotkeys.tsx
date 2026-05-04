import { Keyboard } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

const HOTKEY_LABELS: Record<string, string> = {
  toggleProtection: 'Toggle screen protection',
  toggleVisibility: 'Hide / show overlay',
  quit: 'Quit TalkPilot',
  openSettings: 'Open settings'
}

function formatHotkey(raw: string): string {
  return raw
    .replace('CommandOrControl', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace(/\+/g, '')
    .replace('Comma', ',')
}

export default function HotkeysTab(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const hotkeys = settings?.hotkeys

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Global shortcuts — work even when TalkPilot is hidden.
        </p>
      </div>

      <div className="divide-y divide-border rounded-lg border">
        {hotkeys &&
          Object.entries(hotkeys).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{HOTKEY_LABELS[key] ?? key}</span>
              <kbd className="inline-flex items-center gap-0.5 rounded bg-muted px-2 py-1 text-sm font-mono">
                {formatHotkey(value)}
              </kbd>
            </div>
          ))}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <Keyboard size={14} className="text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Custom hotkey binding coming in a future sprint.
        </p>
      </div>
    </div>
  )
}
