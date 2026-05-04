import { Mic } from 'lucide-react'

export default function AudioTab(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <Mic size={32} className="opacity-30" />
      <p className="text-sm">Audio configuration — coming in Sprint 3</p>
      <p className="text-xs opacity-60">Swift sidecar + ScreenCaptureKit + Apple Speech</p>
    </div>
  )
}
