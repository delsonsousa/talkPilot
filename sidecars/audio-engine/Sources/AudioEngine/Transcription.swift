import Foundation
import Speech
import AVFoundation

class Transcriber {
    private let speaker: Speaker
    let recognizer: SFSpeechRecognizer
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private(set) var isRunning = false
    private let lock = NSLock()
    private var sessionGeneration = 0
    private var activeSessionGeneration: Int?
    private var lastPartialText = ""

    var supportsOnDevice: Bool { recognizer.supportsOnDeviceRecognition }

    init(speaker: Speaker, locale: Locale = Locale(identifier: "pt-BR")) {
        self.speaker = speaker
        self.recognizer = SFSpeechRecognizer(locale: locale)
            ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
        self.recognizer.defaultTaskHint = .dictation
    }

    func start() {
        guard !isRunning else {
            fputs("[transcriber] \(speaker.rawValue) already running, skip\n", stderr)
            return
        }
        isRunning = true
        fputs("[transcriber] \(speaker.rawValue) starting\n", stderr)
        if Thread.isMainThread {
            beginSession()
        } else {
            DispatchQueue.main.sync { self.beginSession() }
        }
    }

    // Creates a new recognition session. Called on main queue.
    // Called again automatically whenever a session ends (final result or error),
    // so transcription continues indefinitely without manual restart.
    private func beginSession() {
        guard isRunning else { return }
        discardCurrentSession(cancelTask: true)
        sessionGeneration += 1
        let generation = sessionGeneration
        activeSessionGeneration = generation
        lastPartialText = ""
        fputs("[transcriber] \(speaker.rawValue) beginning session\n", stderr)

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        // On-device allows two concurrent sessions (mic + system audio).
        // Server-based only allows one at a time — still start both and let Apple
        // handle queuing; errors trigger a retry below.
        req.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition

        lock.lock()
        request = req
        lock.unlock()

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            DispatchQueue.main.async {
                self.handleRecognition(result: result, error: error, generation: generation)
            }
        }
        fputs("[transcriber] \(speaker.rawValue) session ready\n", stderr)
    }

    private func handleRecognition(
        result: SFSpeechRecognitionResult?,
        error: Error?,
        generation: Int
    ) {
        guard isRunning, generation == activeSessionGeneration else { return }

        if let result {
            let text = result.bestTranscription.formattedString
            if !text.isEmpty {
                lastPartialText = text
                emitTranscription(
                    speaker: speaker,
                    text: text,
                    isFinal: result.isFinal
                )
                if result.isFinal {
                    lastPartialText = ""
                }
            }
        }

        if let error {
            let nsError = error as NSError
            let isAssistantError = nsError.domain == "kAFAssistantErrorDomain"
            let noSpeechDetected = isAssistantError && nsError.code == 1110
            // 216 / 301 are normal cancellation codes emitted on stop().
            // 1110 means Apple Speech closed the current request because it
            // did not detect speech; this is expected during silence.
            let isExpectedEnd = isAssistantError
                && (nsError.code == 216 || nsError.code == 301 || nsError.code == 1110)

            if noSpeechDetected, !lastPartialText.isEmpty {
                emitTranscription(
                    speaker: speaker,
                    text: lastPartialText,
                    isFinal: true
                )
                lastPartialText = ""
            }

            if !isExpectedEnd {
                fputs("[speech] \(speaker.rawValue) \(nsError.domain)/\(nsError.code): \(error.localizedDescription)\n", stderr)
            }
        }

        // Session ended (final result or any error). Restart unless stop() was called.
        let sessionEnded = result?.isFinal == true || error != nil
        guard sessionEnded, isRunning else { return }

        activeSessionGeneration = nil
        discardCurrentSession(cancelTask: false)

        let nsError = error as NSError?
        let noSpeechDetected = nsError?.domain == "kAFAssistantErrorDomain" && nsError?.code == 1110
        // Silence can repeat for a while, so avoid a tight retry loop.
        let delay: Double = noSpeechDetected ? 1.5 : (error != nil ? 0.3 : 0.0)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.isRunning, self.sessionGeneration == generation else { return }
            self.beginSession()
        }
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        sessionGeneration += 1
        activeSessionGeneration = nil
        fputs("[transcriber] \(speaker.rawValue) stopping\n", stderr)
        discardCurrentSession(cancelTask: true)
    }

    func finishUtterance() {
        guard isRunning else { return }
        if !lastPartialText.isEmpty {
            emitTranscription(
                speaker: speaker,
                text: lastPartialText,
                isFinal: true
            )
        }
        stop()
    }

    private func discardCurrentSession(cancelTask: Bool) {
        lock.lock()
        request?.endAudio()
        request = nil
        lock.unlock()

        if cancelTask {
            task?.cancel()
        }
        task = nil
        lastPartialText = ""
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        let req = request
        lock.unlock()
        guard isRunning, let req else { return }
        req.append(buffer)
    }

    static func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }
}
