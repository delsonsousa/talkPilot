import Foundation
import Speech
import AVFoundation

class Transcriber {
    private let speaker: Speaker
    private let languageMode: String
    private var currentLocaleIdentifier: String
    private var recognizer: SFSpeechRecognizer
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private(set) var isRunning = false
    private(set) var isFinishingUtterance = false
    private let lock = NSLock()
    private var sessionGeneration = 0
    private var activeSessionGeneration: Int?
    private var lastPartialText = ""
    private var finishTimeout: DispatchWorkItem?
    private var utteranceBuffers: [AVAudioPCMBuffer] = []

    var supportsOnDevice: Bool { recognizer.supportsOnDeviceRecognition }
    var isAcceptingAudio: Bool { isRunning && !isFinishingUtterance }
    private var isAutoLanguage: Bool { languageMode == "auto" }

    init(speaker: Speaker, languageMode: String = "auto") {
        self.speaker = speaker
        self.languageMode = ["auto", "pt-BR", "en-US"].contains(languageMode) ? languageMode : "auto"
        self.currentLocaleIdentifier = languageMode == "en-US" ? "en-US" : "pt-BR"
        self.recognizer = Self.makeRecognizer(localeIdentifier: currentLocaleIdentifier)
        self.recognizer.defaultTaskHint = .dictation
    }

    func start() {
        guard !isRunning else {
            fputs("[transcriber] \(speaker.rawValue) already running, skip\n", stderr)
            return
        }
        isRunning = true
        isFinishingUtterance = false
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
        utteranceBuffers.removeAll()
        finishTimeout?.cancel()
        finishTimeout = nil
        recognizer = Self.makeRecognizer(localeIdentifier: currentLocaleIdentifier)
        recognizer.defaultTaskHint = .dictation
        fputs("[transcriber] \(speaker.rawValue) beginning session locale=\(currentLocaleIdentifier)\n", stderr)

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        req.addsPunctuation = true
        req.contextualStrings = Self.contextualStrings
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
                if !isAutoLanguage {
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

            if !isAutoLanguage, noSpeechDetected, !lastPartialText.isEmpty {
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

        // Session ended (final result or any error). Restart unless this was a
        // voice-gated utterance finish; in that case leave the gate in control
        // of the next start.
        let sessionEnded = result?.isFinal == true || error != nil
        guard sessionEnded, isRunning else { return }

        let finalText = lastPartialText
        let finalBuffers = utteranceBuffers
        let finalLocale = currentLocaleIdentifier
        activeSessionGeneration = nil
        finishTimeout?.cancel()
        finishTimeout = nil
        discardCurrentSession(cancelTask: false)

        if isFinishingUtterance {
            isRunning = false
            isFinishingUtterance = false
            emitFinishedUtterance(primaryText: finalText, primaryLocale: finalLocale, buffers: finalBuffers)
            return
        }

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
        isFinishingUtterance = false
        sessionGeneration += 1
        activeSessionGeneration = nil
        finishTimeout?.cancel()
        finishTimeout = nil
        fputs("[transcriber] \(speaker.rawValue) stopping\n", stderr)
        discardCurrentSession(cancelTask: true)
    }

    func finishUtterance() {
        guard isRunning, !isFinishingUtterance else { return }
        isFinishingUtterance = true
        fputs("[transcriber] \(speaker.rawValue) finishing utterance\n", stderr)

        lock.lock()
        request?.endAudio()
        lock.unlock()

        let generation = activeSessionGeneration
        let timeout = DispatchWorkItem { [weak self] in
            guard let self,
                  self.isRunning,
                  self.isFinishingUtterance,
                  self.activeSessionGeneration == generation
            else { return }

            let finalText = self.lastPartialText
            let finalBuffers = self.utteranceBuffers
            let finalLocale = self.currentLocaleIdentifier

            fputs("[transcriber] \(self.speaker.rawValue) finish timeout, cancelling\n", stderr)
            self.stop()
            self.emitFinishedUtterance(primaryText: finalText, primaryLocale: finalLocale, buffers: finalBuffers)
        }
        finishTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0, execute: timeout)
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
        if isAutoLanguage, let copy = buffer.deepCopyForTranscription() {
            utteranceBuffers.append(copy)
        }
        req.append(buffer)
    }

    private func emitFinishedUtterance(primaryText: String, primaryLocale: String, buffers: [AVAudioPCMBuffer]) {
        guard !primaryText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if !isAutoLanguage {
            emitTranscription(speaker: speaker, text: primaryText, isFinal: true)
            return
        }

        Task {
            let candidate = await chooseBestCandidate(
                primaryText: primaryText,
                primaryLocale: primaryLocale,
                buffers: buffers
            )
            let text = candidate.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }

            currentLocaleIdentifier = candidate.localeIdentifier
            fputs("[transcriber] \(speaker.rawValue) auto language=\(candidate.localeIdentifier) text=\"\(text)\"\n", stderr)
            emitTranscription(speaker: speaker, text: text, isFinal: true)
        }
    }

    private func chooseBestCandidate(
        primaryText: String,
        primaryLocale: String,
        buffers: [AVAudioPCMBuffer]
    ) async -> RecognitionCandidate {
        var candidates = [
            RecognitionCandidate(
                text: primaryText,
                localeIdentifier: primaryLocale,
                confidence: 0.45
            )
        ]

        for localeIdentifier in ["pt-BR", "en-US"] where localeIdentifier != primaryLocale {
            if let candidate = await Self.recognize(buffers: buffers, localeIdentifier: localeIdentifier) {
                candidates.append(candidate)
            }
        }

        return candidates.max { lhs, rhs in
            score(candidate: lhs) < score(candidate: rhs)
        } ?? candidates[0]
    }

    private func score(candidate: RecognitionCandidate) -> Float {
        let text = candidate.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = text.folding(options: .diacriticInsensitive, locale: .current).lowercased()
        let words = normalized.split { !$0.isLetter }.count
        var value = candidate.confidence

        if candidate.localeIdentifier == "pt-BR", looksPortuguese(normalized) { value += 0.35 }
        if candidate.localeIdentifier == "en-US", looksEnglish(normalized) { value += 0.35 }
        if words >= 3 { value += 0.12 }
        if words <= 1 { value -= 0.12 }
        if candidate.localeIdentifier == "pt-BR", isLikelyEnglishFalsePositive(normalized) { value -= 0.45 }

        return value
    }

    private func looksPortuguese(_ text: String) -> Bool {
        let markers = [" o ", " a ", " que ", " voce ", " você ", " qual ", " diferenca ", " diferença ", " entre ", " como ", " porque "]
        return markers.contains { " \(text) ".contains($0) }
    }

    private func looksEnglish(_ text: String) -> Bool {
        let markers = [" the ", " what ", " which ", " can ", " you ", " listen ", " help ", " react ", " next ", " difference ", " between "]
        return markers.contains { " \(text) ".contains($0) }
    }

    private func isLikelyEnglishFalsePositive(_ text: String) -> Bool {
        ["que delicia", "quer dizer", "que beleza"].contains(text)
    }

    private struct RecognitionCandidate {
        let text: String
        let localeIdentifier: String
        let confidence: Float
    }

    private static func makeRecognizer(localeIdentifier: String) -> SFSpeechRecognizer {
        SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier))
            ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
    }

    private static let contextualStrings = [
        "React",
        "React Native",
        "Expo",
        "Expo Go",
        "Next.js",
        "Next JS",
        "JavaScript",
        "TypeScript",
        "Node.js",
        "Vercel",
        "Webpack",
        "Turbopack",
        "SSG",
        "SSR",
        "ISR",
        "CSR",
        "RSC",
        "API Routes",
        "getStaticProps",
        "getServerSideProps",
        "getStaticPaths",
        "frontend",
        "backend",
        "mobile app",
        "framework",
        "library",
        "biblioteca",
        "aplicativo mobile",
        "renderização",
        "servidor",
        "cliente",
        "Python",
        "Docker",
        "Kubernetes",
        "AWS",
        "PostgreSQL",
        "MongoDB",
        "GraphQL",
        "REST API",
        "webhook",
        "deploy",
        "deployment"
    ]

    private static func recognize(buffers: [AVAudioPCMBuffer], localeIdentifier: String) async -> RecognitionCandidate? {
        guard !buffers.isEmpty else { return nil }
        let recognizer = makeRecognizer(localeIdentifier: localeIdentifier)
        recognizer.defaultTaskHint = .dictation

        return await withCheckedContinuation { continuation in
            let lock = NSLock()
            var didResume = false
            var bestText = ""
            var bestConfidence: Float = 0.35
            var recognitionTask: SFSpeechRecognitionTask?

            func resumeOnce(_ candidate: RecognitionCandidate?) {
                lock.lock()
                defer { lock.unlock() }
                guard !didResume else { return }
                didResume = true
                recognitionTask?.cancel()
                continuation.resume(returning: candidate)
            }

            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            req.addsPunctuation = true
            req.contextualStrings = contextualStrings
            req.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition

            recognitionTask = recognizer.recognitionTask(with: req) { result, error in
                if let result {
                    let text = result.bestTranscription.formattedString
                    if !text.isEmpty {
                        bestText = text
                        let confidences = result.bestTranscription.segments
                            .map(\.confidence)
                            .filter { $0 > 0 }
                        if !confidences.isEmpty {
                            bestConfidence = confidences.reduce(0, +) / Float(confidences.count)
                        }
                    }
                    if result.isFinal {
                        resumeOnce(RecognitionCandidate(
                            text: bestText,
                            localeIdentifier: localeIdentifier,
                            confidence: bestConfidence
                        ))
                    }
                }

                if error != nil {
                    let text = bestText.trimmingCharacters(in: .whitespacesAndNewlines)
                    resumeOnce(text.isEmpty ? nil : RecognitionCandidate(
                        text: text,
                        localeIdentifier: localeIdentifier,
                        confidence: bestConfidence
                    ))
                }
            }

            for buffer in buffers {
                req.append(buffer)
            }
            req.endAudio()

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
                let text = bestText.trimmingCharacters(in: .whitespacesAndNewlines)
                resumeOnce(text.isEmpty ? nil : RecognitionCandidate(
                    text: text,
                    localeIdentifier: localeIdentifier,
                    confidence: bestConfidence
                ))
            }
        }
    }

    static func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
    }
}

private extension AVAudioPCMBuffer {
    func deepCopyForTranscription() -> AVAudioPCMBuffer? {
        guard let copy = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else { return nil }
        copy.frameLength = frameLength

        guard let source = floatChannelData,
              let target = copy.floatChannelData
        else { return nil }

        let channels = Int(format.channelCount)
        let frames = Int(frameLength)
        for channel in 0..<channels {
            target[channel].update(from: source[channel], count: frames)
        }

        return copy
    }
}
