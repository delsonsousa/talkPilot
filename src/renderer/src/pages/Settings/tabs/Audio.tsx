import { Languages, Mic } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settingsStore'

export default function AudioTab(): JSX.Element {
  const { settings, setSetting } = useSettingsStore()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Audio</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Configurações da transcrição local com Apple Speech e captura de áudio do sistema.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Languages size={15} />
          <span>Idioma da transcrição</span>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Use automático para alternar entre português e inglês a cada fala.
        </p>
        <div className="space-y-2">
          <Label htmlFor="language">Idioma</Label>
          <Select
            id="language"
            value={settings?.language ?? 'auto'}
            onChange={(event) => setSetting('language', event.target.value)}
            className="w-72"
          >
            <option value="auto">Automático: Português + Inglês</option>
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
        <Mic size={16} className="mt-0.5 shrink-0 opacity-60" />
        <p>
          Alterações de idioma entram em vigor na próxima vez que você iniciar a gravação.
        </p>
      </div>
    </div>
  )
}
