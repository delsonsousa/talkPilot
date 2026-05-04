import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

export type SidecarState = 'stopped' | 'ready' | 'monitoring' | 'recording' | 'error'

export interface TranscriptionEvent {
  speaker: 'YOU' | 'OTHERS'
  text: string
  timestamp: number
  isFinal: boolean
}

export interface AudioLevelsEvent {
  you: number
  others: number
}

export type ModelDownloadPhase = 'downloading' | 'ready' | 'failed'

export interface ModelStatusEvent {
  phase: ModelDownloadPhase
  reason?: string
}

export interface AudioDevice {
  uid: string
  name: string
}

type SidecarEvents = {
  transcription: [TranscriptionEvent]
  levels: [AudioLevelsEvent]
  status: [SidecarState]
  error: [{ code: string; message: string }]
  modelStatus: [ModelStatusEvent]
  devices: [{ devices: AudioDevice[]; selectedUID: string | null }]
}

export class SidecarManager extends EventEmitter {
  private process: ChildProcess | null = null
  private state: SidecarState = 'stopped'
  private restartAttempts = 0
  private readonly maxRestarts = 3
  private isStopping = false
  private stopTimer: NodeJS.Timeout | null = null

  private get binaryPath(): string {
    // In dev: app.getAppPath() = project root (where package.json lives)
    const devPath = join(app.getAppPath(), 'sidecars/audio-engine/.build/release/AudioEngine')
    // In prod: bundled inside the app Resources
    const prodPath = join(process.resourcesPath ?? '', 'AudioEngine')
    return existsSync(devPath) ? devPath : prodPath
  }

  start(): void {
    if (this.process) return
    this.isStopping = false
    const binary = this.binaryPath

    if (!existsSync(binary)) {
      const msg = `Sidecar binary not found at ${binary}. Run: cd sidecars/audio-engine && swift build -c release`
      console.error('[audio]', msg)
      this.setState('error')
      this.emit('error', { code: 'BINARY_NOT_FOUND', message: msg })
      return
    }

    console.log('[audio] spawning sidecar:', binary)
    this.process = spawn(binary, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
    })

    this.process.stdout?.setEncoding('utf8')
    this.process.stdout?.on('data', (chunk: string) => {
      if (this.isStopping) return
      for (const line of chunk.split('\n')) {
        if (line.trim()) this.handleMessage(line.trim())
      }
    })

    this.process.stderr?.setEncoding('utf8')
    this.process.stderr?.on('data', (data: string) => {
      if (this.isStopping) return
      console.error('[audio][stderr]', data.trim())
    })

    this.process.on('exit', (code, signal) => {
      const wasStopping = this.isStopping
      const wasInterrupted = signal === 'SIGINT' || signal === 'SIGTERM'
      if (!wasStopping && !wasInterrupted) {
        console.log(`[audio] sidecar exited (code=${code} signal=${signal})`)
      }
      this.process = null
      if (!wasStopping && !wasInterrupted && this.state === 'recording' && this.restartAttempts < this.maxRestarts) {
        this.restartAttempts++
        console.log(`[audio] restarting sidecar (attempt ${this.restartAttempts})`)
        setTimeout(() => this.start(), 1000)
      } else if (!wasStopping && !wasInterrupted) {
        this.setState('stopped')
      } else {
        this.state = 'stopped'
      }
    })
  }

  stop(options: { quiet?: boolean; force?: boolean } = {}): void {
    const { quiet = false, force = false } = options
    this.restartAttempts = this.maxRestarts // prevent auto-restart
    this.isStopping = true

    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }

    const child = this.process
    if (!child) {
      this.setState('stopped', { quiet, emit: !quiet })
      return
    }

    child.stdout?.removeAllListeners('data')
    child.stderr?.removeAllListeners('data')

    if (!force) this.sendCommand('stop')

    const killSidecar = (): void => {
      if (child.exitCode === null && !child.killed) child.kill()
      if (this.process === child) this.process = null
      this.setState('stopped', { quiet, emit: !quiet })
    }

    if (force) {
      killSidecar()
    } else {
      this.stopTimer = setTimeout(killSidecar, 200)
      this.stopTimer.unref?.()
    }
  }

  startRecording(language = 'auto'): void {
    if (!this.process) this.start()
    this.restartAttempts = 0
    setTimeout(() => this.sendCommand('start', { language }), 100)
  }

  stopRecording(): void {
    this.sendCommand('stop')
  }

  startMonitoring(): void {
    if (!this.process) this.start()
    if (this.state === 'recording' || this.state === 'monitoring') return
    setTimeout(() => this.sendCommand('start_monitoring'), 100)
  }

  stopMonitoring(): void {
    if (this.state !== 'monitoring') return
    this.sendCommand('stop_monitoring')
  }

  ping(): void {
    this.sendCommand('ping')
  }

  listDevices(): void {
    this.sendCommand('list_devices')
  }

  setDevice(uid: string | null): void {
    this.sendCommand('set_device', uid ? { deviceUID: uid } : {})
  }

  getState(): SidecarState {
    return this.state
  }

  private sendCommand(command: string, payload: Record<string, unknown> = {}): void {
    if (!this.process?.stdin) return
    const msg = JSON.stringify({ command, ...payload }) + '\n'
    this.process.stdin.write(msg)
  }

  private handleMessage(line: string): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(line)
    } catch {
      console.warn('[audio] unparseable line:', line)
      return
    }

    switch (msg.type) {
      case 'transcription':
        this.emit('transcription', msg as unknown as TranscriptionEvent)
        break
      case 'audio_levels':
        this.emit('levels', msg as unknown as AudioLevelsEvent)
        break
      case 'status':
        this.setState(msg.state as SidecarState)
        break
      case 'error':
        console.error('[audio][sidecar]', msg.code, msg.message)
        this.emit('error', { code: msg.code, message: msg.message })
        break
      case 'model_status':
        console.log('[audio] model status:', msg.phase)
        this.emit('modelStatus', { phase: msg.phase, reason: msg.reason })
        break
      case 'devices_list':
        this.emit('devices', { devices: msg.devices, selectedUID: msg.selectedUID ?? null })
        break
    }
  }

  private setState(state: SidecarState, options: { quiet?: boolean; emit?: boolean } = {}): void {
    const { quiet = false, emit = true } = options
    if (this.state === state) return
    this.state = state
    if (emit) this.emit('status', state)
    if (!quiet) console.log('[audio] state:', state)
  }
}

export const sidecar = new SidecarManager()
