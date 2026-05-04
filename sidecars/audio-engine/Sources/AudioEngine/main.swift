import Foundation
import Speech
import AVFoundation

// MARK: - State

let mic = MicCapture()
let systemAudio = SystemAudioCapture()
let youSpeechWorker = SpeechWorkerClient(speaker: .you)
let othersSpeechWorker = SpeechWorkerClient(speaker: .others)

var isRecording = false
var isMonitoring = false
var youLevel: Float = 0
var othersLevel: Float = 0

// MARK: - On-device model check
// The system downloads on-device models automatically when requiresOnDeviceRecognition
// is used in recognition requests. We just report current availability.

func emitOnDeviceStatus() {
    let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "pt-BR"))
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    if recognizer?.supportsOnDeviceRecognition == true {
        fputs("[sidecar] on-device recognition available\n", stderr)
        emitModelStatus(.ready)
    } else {
        fputs("[sidecar] on-device recognition unavailable — compatibility mode\n", stderr)
        emitModelStatus(.failed, reason: "On-device model not yet available")
    }
}

// MARK: - Start / Stop

func requestMicPermission() async -> Bool {
    await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
        AVCaptureDevice.requestAccess(for: .audio) { granted in cont.resume(returning: granted) }
    }
}

func wireLevelCallbacks(transcribing: Bool) {
    mic.onBuffer = transcribing ? { youSpeechWorker.append($0) } : nil
    mic.onLevel  = { level in youLevel = level }
    systemAudio.onBuffer = transcribing ? { othersSpeechWorker.append($0) } : nil
    systemAudio.onLevel  = { level in othersLevel = level }
}

func startMonitoring() async {
    guard !isRecording else { return }
    guard !isMonitoring else { return }
    isMonitoring = true
    fputs("[sidecar] startMonitoring: begin\n", stderr)

    let micOK = await requestMicPermission()
    fputs("[sidecar] monitor mic permission: \(micOK)\n", stderr)
    guard micOK else {
        isMonitoring = false
        emitError(code: "PERMISSION_DENIED_MIC",
                  "Acesse Ajustes > Privacidade > Microfone e permita TalkPilot")
        return
    }

    wireLevelCallbacks(transcribing: false)

    do {
        try mic.start()
        fputs("[sidecar] monitor mic started\n", stderr)
    } catch {
        isMonitoring = false
        mic.stop()
        fputs("[sidecar] monitor mic FAILED: \(error)\n", stderr)
        emitError(code: "MIC_ERROR", error.localizedDescription)
        return
    }

    emitStatus(.monitoring)
    startLevelTimer()

    DispatchQueue.main.async {
        Task {
            guard isMonitoring && !isRecording else { return }
            do {
                try await systemAudio.start()
                fputs("[sidecar] monitor system audio started\n", stderr)
            } catch {
                fputs("[sidecar] monitor system audio failed: \(error)\n", stderr)
                emitError(code: "SYSTEM_AUDIO_ERROR",
                          "Audio do computador indisponivel: \(error.localizedDescription)")
            }
        }
    }

    fputs("[sidecar] startMonitoring: done\n", stderr)
}

func stopMonitoring(emitReady: Bool = true) async {
    guard isMonitoring && !isRecording else { return }
    isMonitoring = false
    levelTimer?.invalidate()
    levelTimer = nil

    mic.stop()
    await systemAudio.stop()
    mic.onBuffer = nil
    systemAudio.onBuffer = nil

    if emitReady { emitStatus(.ready) }
    fputs("[sidecar] monitoring stopped\n", stderr)
}

func startCapture(language: String = "auto") async {
    guard !isRecording else {
        fputs("[sidecar] startCapture: already recording, ignoring\n", stderr)
        return
    }
    if isMonitoring {
        await stopMonitoring(emitReady: false)
    }
    // Set flag BEFORE any suspension point to prevent concurrent calls from re-entering.
    isRecording = true
    fputs("[sidecar] startCapture: begin language=\(language)\n", stderr)

    // 1. Speech Recognition permission
    let speechOK = await Transcriber.requestAuthorization()
    fputs("[sidecar] speech permission: \(speechOK)\n", stderr)
    guard speechOK else {
        isRecording = false
        emitError(code: "PERMISSION_DENIED_SPEECH",
                  "Acesse Ajustes > Privacidade > Reconhecimento de Fala e permita TalkPilot")
        return
    }

    // 2. Microphone permission
    let micOK = await requestMicPermission()
    fputs("[sidecar] mic permission: \(micOK)\n", stderr)
    guard micOK else {
        isRecording = false
        emitError(code: "PERMISSION_DENIED_MIC",
                  "Acesse Ajustes > Privacidade > Microfone e permita TalkPilot")
        return
    }

    // 3. Report on-device availability
    emitOnDeviceStatus()

    // Wire audio callbacks
    wireLevelCallbacks(transcribing: true)

    youSpeechWorker.start(language: language)
    othersSpeechWorker.start(language: language)

    // 4. Start mic capture
    do {
        try mic.start()
        fputs("[sidecar] mic started\n", stderr)
    } catch {
        isRecording = false
        mic.stop()
        youSpeechWorker.stop()
        othersSpeechWorker.stop()
        fputs("[sidecar] mic FAILED: \(error)\n", stderr)
        emitError(code: "MIC_ERROR", error.localizedDescription)
        return
    }

    // Emit recording status immediately once mic is ready.
    // Don't wait for system audio — it may take longer (ScreenCaptureKit permission
    // dialog, stream setup) and blocking here means the UI never shows "recording".
    fputs("[sidecar] emitting recording status\n", stderr)
    emitStatus(.recording)
    startLevelTimer()

    // 6. Start system audio in background (non-fatal, UI already reflects recording).
    // ScreenCaptureKit is much more reliable when stream setup starts from the main queue.
    fputs("[sidecar] scheduling system audio start\n", stderr)
    DispatchQueue.main.async {
        Task {
            guard isRecording else { return }
            do {
                try await systemAudio.start()
                fputs("[sidecar] system audio started\n", stderr)
            } catch {
                othersSpeechWorker.stop()
                fputs("[sidecar] system audio failed (mic-only): \(error)\n", stderr)
                emitError(code: "SYSTEM_AUDIO_ERROR",
                          "Audio do computador indisponivel: \(error.localizedDescription)")
            }
        }
    }

    fputs("[sidecar] startCapture: done\n", stderr)
}

func stopCapture() async {
    if isMonitoring && !isRecording {
        await stopMonitoring()
        return
    }
    guard isRecording else { return }
    isRecording = false
    levelTimer?.invalidate()
    levelTimer = nil

    mic.stop()
    await systemAudio.stop()
    youSpeechWorker.stop()
    othersSpeechWorker.stop()
    mic.onBuffer = nil
    systemAudio.onBuffer = nil

    emitStatus(.stopped)
    fputs("[sidecar] stopped\n", stderr)
}

// MARK: - Level timer

var levelTimer: Timer?

func startLevelTimer() {
    // Must run on RunLoop.main — Timer.scheduledTimer picks the *current* RunLoop,
    // which inside a Swift Task may be a cooperative-pool thread with no running loop.
    DispatchQueue.main.async {
        levelTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in
            let you    = youLevel
            let others = othersLevel
            emitLevels(you: you, others: others)
            youLevel    = 0
            othersLevel = 0
        }
    }
}

// MARK: - Stdin command loop

func readCommands() {
    let decoder = JSONDecoder()
    while let line = readLine(strippingNewline: true) {
        guard !line.isEmpty,
              let data = line.data(using: .utf8),
              let cmd = try? decoder.decode(CommandMessage.self, from: data)
        else { continue }

        switch cmd.command {
        case .start:
            Task { await startCapture(language: cmd.language ?? "auto") }
        case .stop:
            Task { await stopCapture() }
        case .ping:
            emitStatus(isRecording ? .recording : (isMonitoring ? .monitoring : .ready))
        case .startMonitoring:
            Task { await startMonitoring() }
        case .stopMonitoring:
            Task { await stopMonitoring() }
        case .listDevices:
            let devices = listInputDevices()
            let selectedUID = mic.selectedDeviceUID ?? defaultInputDeviceUID()
            emitDevicesList(devices: devices, selectedUID: selectedUID)
        case .setDevice:
            let uid = cmd.deviceUID
            mic.selectedDeviceUID = uid
            if isRecording {
                Task {
                    await stopCapture()
                    await startCapture(language: "auto")
                }
            } else if isMonitoring {
                Task {
                    await stopMonitoring(emitReady: false)
                    await startMonitoring()
                }
            }
        }
    }
}

// MARK: - Entry point

if CommandLine.arguments.count >= 3,
   CommandLine.arguments[1] == "--speech-worker",
   let speaker = Speaker(rawValue: CommandLine.arguments[2]) {
    let language = CommandLine.arguments.count >= 4 ? CommandLine.arguments[3] : "auto"
    runSpeechWorker(speaker: speaker, language: language)
} else {
    emitStatus(.ready)

    Thread.detachNewThread { readCommands() }

    RunLoop.main.run()
}
