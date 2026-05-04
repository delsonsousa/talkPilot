import Foundation

// MARK: - Outbound (sidecar → Electron via stdout)

enum Speaker: String, Codable {
    case you = "YOU"
    case others = "OTHERS"
}

struct TranscriptionMessage: Codable {
    let type = "transcription"
    let speaker: Speaker
    let text: String
    let timestamp: TimeInterval
    let isFinal: Bool

    enum CodingKeys: String, CodingKey {
        case type, speaker, text, timestamp, isFinal
    }
}

struct AudioLevelsMessage: Codable {
    let type = "audio_levels"
    let you: Float
    let others: Float

    enum CodingKeys: String, CodingKey {
        case type, you, others
    }
}

enum SidecarState: String, Codable {
    case ready, recording, stopped
}

struct StatusMessage: Codable {
    let type = "status"
    let state: SidecarState

    enum CodingKeys: String, CodingKey {
        case type, state
    }
}

struct ErrorMessage: Codable {
    let type = "error"
    let code: String
    let message: String

    enum CodingKeys: String, CodingKey {
        case type, code, message
    }
}

enum ModelDownloadPhase: String, Codable {
    case downloading, ready, failed
}

struct ModelStatusMessage: Codable {
    let type = "model_status"
    let phase: ModelDownloadPhase
    let reason: String?

    enum CodingKeys: String, CodingKey {
        case type, phase, reason
    }
}

// MARK: - Inbound (Electron → sidecar via stdin)

enum InboundCommand: String, Codable {
    case start, stop, ping
}

struct CommandMessage: Codable {
    let command: InboundCommand
}

// MARK: - I/O helpers

private let encoder = JSONEncoder()
private let outputLock = NSLock()

func emit<T: Encodable>(_ message: T) {
    guard let data = try? encoder.encode(message),
          let line = String(data: data, encoding: .utf8) else { return }
    outputLock.lock()
    print(line)
    fflush(stdout)
    outputLock.unlock()
}

func forwardOutput(_ data: Data) {
    outputLock.lock()
    FileHandle.standardOutput.write(data)
    fflush(stdout)
    outputLock.unlock()
}

func emitStatus(_ state: SidecarState) {
    emit(StatusMessage(state: state))
}

func emitError(code: String, _ message: String) {
    emit(ErrorMessage(code: code, message: message))
}

func emitTranscription(speaker: Speaker, text: String, isFinal: Bool) {
    emit(TranscriptionMessage(
        speaker: speaker,
        text: text,
        timestamp: Date().timeIntervalSince1970,
        isFinal: isFinal
    ))
}

func emitLevels(you: Float, others: Float) {
    emit(AudioLevelsMessage(you: you, others: others))
}

func emitModelStatus(_ phase: ModelDownloadPhase, reason: String? = nil) {
    emit(ModelStatusMessage(phase: phase, reason: reason))
}
