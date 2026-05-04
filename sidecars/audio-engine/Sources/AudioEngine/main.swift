import Foundation
import Speech
import AVFoundation

// MARK: - State

let mic = MicCapture()
let systemAudio = SystemAudioCapture()
let youSpeechWorker = SpeechWorkerClient(speaker: .you)
let othersSpeechWorker = SpeechWorkerClient(speaker: .others)

var isRecording = false
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

func startCapture(language: String = "auto") async {
    guard !isRecording else {
        fputs("[sidecar] startCapture: already recording, ignoring\n", stderr)
        return
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
    let micOK = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
        AVCaptureDevice.requestAccess(for: .audio) { granted in cont.resume(returning: granted) }
    }
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
    mic.onBuffer = { youSpeechWorker.append($0) }
    mic.onLevel  = { level in youLevel = level }
    systemAudio.onBuffer = { othersSpeechWorker.append($0) }
    systemAudio.onLevel  = { level in othersLevel = level }

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
    guard isRecording else { return }
    isRecording = false
    levelTimer?.invalidate()
    levelTimer = nil

    mic.stop()
    await systemAudio.stop()
    youSpeechWorker.stop()
    othersSpeechWorker.stop()

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
            emitStatus(isRecording ? .recording : .ready)
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
