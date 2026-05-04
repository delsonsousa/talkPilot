import { Shield, ShieldOff } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { Button } from '@/components/ui/button'

export default function PrivacyTab(): JSX.Element {
  const { settings, setSetting } = useSettingsStore()
  const protectionDefault = settings?.contentProtectionDefault ?? true

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Privacy</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Control what others can see when you share your screen.
        </p>
      </div>

      <div className="flex items-start justify-between rounded-lg border p-4">
        <div className="flex items-start gap-3">
          {protectionDefault ? (
            <Shield size={18} className="mt-0.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldOff size={18} className="mt-0.5 text-red-400 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">Screen protection on startup</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the overlay is invisible to screen sharing tools (Zoom, Meet, Teams).
            </p>
          </div>
        </div>
        <Button
          variant={protectionDefault ? 'outline' : 'default'}
          size="sm"
          onClick={() => setSetting('contentProtectionDefault', !protectionDefault)}
        >
          {protectionDefault ? 'Enabled' : 'Disabled'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        All data — transcripts, settings, API keys — is stored locally on your machine. Nothing is
        sent to any server except the LLM provider you configure.
      </p>
    </div>
  )
}
