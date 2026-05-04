import Foundation
import AVFoundation

private struct AudioFrameMessage: Codable {
    let sampleRate: Double
    let channels: Int
    let frameLength: Int
    let data: String
}

private let audioFrameEncoder = JSONEncoder()
private let audioFrameDecoder = JSONDecoder()
private let workerOutputQueue = DispatchQueue(label: "talkpilot.speech-worker.stdout")

final class SpeechWorkerClient {
    private let speaker: Speaker
    private var process: Process?
    private var inputPipe: Pipe?
    private let writeQueue: DispatchQueue

    init(speaker: Speaker) {
        self.speaker = speaker
        self.writeQueue = DispatchQueue(label: "talkpilot.speech-worker.\(speaker.rawValue)")
    }

    func start() {
        guard process == nil else { return }

        let child = Process()
        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()

        child.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
        child.arguments = ["--speech-worker", speaker.rawValue]
        child.standardInput = stdinPipe
        child.standardOutput = stdoutPipe
        child.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            workerOutputQueue.async {
                forwardOutput(data)
            }
        }

        stderrPipe.fileHandleForReading.readabilityHandler = { [speaker] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            if let text = String(data: data, encoding: .utf8) {
                fputs("[speech-worker][\(speaker.rawValue)] \(text)", stderr)
            }
        }

        child.terminationHandler = { [speaker] process in
            fputs("[speech-worker][\(speaker.rawValue)] exited code=\(process.terminationStatus)\n", stderr)
        }

        do {
            try child.run()
            process = child
            inputPipe = stdinPipe
            fputs("[speech-worker][\(speaker.rawValue)] started\n", stderr)
        } catch {
            emitError(code: "SPEECH_WORKER_ERROR", "Failed to start \(speaker.rawValue) speech worker: \(error.localizedDescription)")
        }
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        guard process?.isRunning == true,
              let inputPipe,
              let message = encodeAudioFrame(buffer)
        else { return }

        writeQueue.async {
            guard let data = try? audioFrameEncoder.encode(message) else { return }
            inputPipe.fileHandleForWriting.write(data)
            inputPipe.fileHandleForWriting.write(Data([0x0A]))
        }
    }

    func stop() {
        writeQueue.sync {
            try? inputPipe?.fileHandleForWriting.close()
        }

        process?.terminate()
        process = nil
        inputPipe = nil
    }
}

func runSpeechWorker(speaker: Speaker) {
    let transcriber = Transcriber(speaker: speaker)
    let voiceGate = VoiceGate(speaker: speaker, transcriber: transcriber)

    Task {
        let speechOK = await Transcriber.requestAuthorization()
        guard speechOK else {
            emitError(code: "PERMISSION_DENIED_SPEECH", "Speech recognition permission denied")
            return
        }
        fputs("[transcriber] \(speaker.rawValue) voice gate ready\n", stderr)
    }

    Thread.detachNewThread {
        while let line = readLine(strippingNewline: true) {
            guard let data = line.data(using: .utf8),
                  let message = try? audioFrameDecoder.decode(AudioFrameMessage.self, from: data),
                  let buffer = decodeAudioFrame(message)
            else { continue }

            voiceGate.append(buffer)
        }

        DispatchQueue.main.async {
            voiceGate.stop()
            exit(0)
        }
    }

    RunLoop.main.run()
}

private final class VoiceGate {
    private let speaker: Speaker
    private let transcriber: Transcriber
    private var preRoll: [AVAudioPCMBuffer] = []
    private var preRollFrames = 0
    private var silenceFrames = 0
    private var didLogSpeechStart = false

    private let startThreshold: Float
    private let stopThreshold: Float
    private let preRollSeconds = 0.5
    private let silenceSeconds: Double

    init(speaker: Speaker, transcriber: Transcriber) {
        self.speaker = speaker
        self.transcriber = transcriber

        switch speaker {
        case .you:
            startThreshold = 0.012
            stopThreshold = 0.006
            silenceSeconds = 1.4
        case .others:
            startThreshold = 0.006
            stopThreshold = 0.003
            silenceSeconds = 2.0
        }
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        let rms = buffer.rmsLevel()
        let sampleRate = buffer.format.sampleRate
        let frameLength = Int(buffer.frameLength)

        rememberPreRoll(buffer)

        if transcriber.isRunning {
            transcriber.append(buffer)

            if rms < stopThreshold {
                silenceFrames += frameLength
                if Double(silenceFrames) / sampleRate >= silenceSeconds {
                    transcriber.finishUtterance()
                    silenceFrames = 0
                    didLogSpeechStart = false
                }
            } else {
                silenceFrames = 0
            }

            return
        }

        guard rms >= startThreshold else { return }

        silenceFrames = 0
        transcriber.start()
        if !didLogSpeechStart {
            didLogSpeechStart = true
            fputs("[voice-gate] \(speaker.rawValue) speech start rms=\(rms)\n", stderr)
        }
        for queuedBuffer in preRoll {
            transcriber.append(queuedBuffer)
        }
    }

    func stop() {
        transcriber.stop()
        preRoll.removeAll()
        preRollFrames = 0
        silenceFrames = 0
    }

    private func rememberPreRoll(_ buffer: AVAudioPCMBuffer) {
        guard let copy = buffer.deepCopy() else { return }
        preRoll.append(copy)
        preRollFrames += Int(copy.frameLength)

        let maxFrames = Int(buffer.format.sampleRate * preRollSeconds)
        while preRollFrames > maxFrames, !preRoll.isEmpty {
            let removed = preRoll.removeFirst()
            preRollFrames -= Int(removed.frameLength)
        }
    }
}

private extension AVAudioPCMBuffer {
    func rmsLevel() -> Float {
        guard let channelData = floatChannelData else { return 0 }
        let channels = Int(format.channelCount)
        let frameLength = Int(frameLength)
        guard channels > 0, frameLength > 0 else { return 0 }

        var sum: Float = 0
        for channel in 0..<channels {
            let samples = UnsafeBufferPointer(start: channelData[channel], count: frameLength)
            for sample in samples {
                sum += sample * sample
            }
        }

        return sqrt(sum / Float(channels * frameLength))
    }

    func deepCopy() -> AVAudioPCMBuffer? {
        guard let copy = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else { return nil }
        copy.frameLength = frameLength

        guard let source = floatChannelData,
              let target = copy.floatChannelData
        else { return nil }

        let channels = Int(format.channelCount)
        let frameLength = Int(frameLength)
        for channel in 0..<channels {
            target[channel].update(from: source[channel], count: frameLength)
        }

        return copy
    }
}

private func encodeAudioFrame(_ buffer: AVAudioPCMBuffer) -> AudioFrameMessage? {
    guard let normalized = normalizeForSpeech(buffer),
          let channelData = normalized.floatChannelData
    else { return nil }

    let channels = Int(normalized.format.channelCount)
    let frameLength = Int(normalized.frameLength)
    guard channels > 0, frameLength > 0 else { return nil }

    var samples = [Float]()
    samples.reserveCapacity(channels * frameLength)

    for channel in 0..<channels {
        let channelSamples = UnsafeBufferPointer(start: channelData[channel], count: frameLength)
        samples.append(contentsOf: channelSamples)
    }

    let data = samples.withUnsafeBufferPointer { Data(buffer: $0) }
    return AudioFrameMessage(
        sampleRate: normalized.format.sampleRate,
        channels: channels,
        frameLength: frameLength,
        data: data.base64EncodedString()
    )
}

private func decodeAudioFrame(_ message: AudioFrameMessage) -> AVAudioPCMBuffer? {
    guard let data = Data(base64Encoded: message.data),
          message.channels > 0,
          message.frameLength > 0,
          data.count == message.channels * message.frameLength * MemoryLayout<Float>.size,
          let format = AVAudioFormat(
            standardFormatWithSampleRate: message.sampleRate,
            channels: AVAudioChannelCount(message.channels)
          ),
          let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(message.frameLength)
          ),
          let channelData = buffer.floatChannelData
    else { return nil }

    buffer.frameLength = AVAudioFrameCount(message.frameLength)

    data.withUnsafeBytes { rawBuffer in
        guard let base = rawBuffer.bindMemory(to: Float.self).baseAddress else { return }
        for channel in 0..<message.channels {
            let source = base.advanced(by: channel * message.frameLength)
            channelData[channel].update(from: source, count: message.frameLength)
        }
    }

    return buffer
}

private func normalizeForSpeech(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
    let channels = max(buffer.format.channelCount, 1)
    guard let targetFormat = AVAudioFormat(
        standardFormatWithSampleRate: buffer.format.sampleRate,
        channels: channels
    ) else { return nil }

    if buffer.format.commonFormat == .pcmFormatFloat32,
       buffer.format.isInterleaved == false,
       buffer.format.channelCount == targetFormat.channelCount,
       buffer.floatChannelData != nil {
        return buffer
    }

    guard let converter = AVAudioConverter(from: buffer.format, to: targetFormat),
          let output = AVAudioPCMBuffer(
            pcmFormat: targetFormat,
            frameCapacity: AVAudioFrameCount(
                Double(buffer.frameLength) * targetFormat.sampleRate / buffer.format.sampleRate
            ) + 1
          )
    else { return nil }

    var didProvideInput = false
    var conversionError: NSError?
    let status = converter.convert(to: output, error: &conversionError) { _, outStatus in
        if didProvideInput {
            outStatus.pointee = .noDataNow
            return nil
        }
        didProvideInput = true
        outStatus.pointee = .haveData
        return buffer
    }

    guard status != .error else { return nil }
    return output
}
