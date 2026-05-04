import Foundation
import AVFoundation
import ScreenCaptureKit
import CoreGraphics

enum AudioCaptureError: LocalizedError {
    case screenRecordingPermissionDenied
    case noDisplay
    case shareableContentTimeout
    case shareableContentUnavailable

    var errorDescription: String? {
        switch self {
        case .screenRecordingPermissionDenied:
            return "Screen Recording permission is required for system audio capture"
        case .noDisplay:
            return "No display found for ScreenCaptureKit"
        case .shareableContentTimeout:
            return "Timed out while waiting for ScreenCaptureKit shareable content"
        case .shareableContentUnavailable:
            return "ScreenCaptureKit did not return shareable content"
        }
    }
}

// MARK: - Mic capture (YOU)

class MicCapture {
    private let engine = AVAudioEngine()
    private var levelTimer: Timer?
    var onBuffer: ((AVAudioPCMBuffer) -> Void)?
    var onLevel: ((Float) -> Void)?

    func start() throws {
        let input = engine.inputNode

        // Always remove any stale tap before installing (prevents "nullptr == Tap()" crash
        // if engine.start() failed on a previous call and the tap was never cleaned up).
        input.removeTap(onBus: 0)

        // Passing nil lets AVAudioEngine pick the hardware's native format, which avoids
        // the format-mismatch that causes engine.start() to throw when the format was read
        // before the engine was running.
        input.installTap(onBus: 0, bufferSize: 4096, format: nil) { [weak self] buffer, _ in
            self?.onBuffer?(buffer)
            if let channelData = buffer.floatChannelData?[0] {
                let frameLength = Int(buffer.frameLength)
                let samples = UnsafeBufferPointer(start: channelData, count: frameLength)
                let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(frameLength))
                self?.onLevel?(min(rms * 10, 1.0))
            }
        }

        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        levelTimer?.invalidate()
    }
}

// MARK: - System audio capture (OTHERS) via ScreenCaptureKit

class SystemAudioCapture: NSObject, SCStreamOutput, SCStreamDelegate {
    private var stream: SCStream?
    private var sampleRate: Double = 16000
    private var didLogFirstBuffer = false
    private var didLogDecodeFailure = false
    private var noAudioTimer: DispatchSourceTimer?
    private var didStopBeforeFirstBuffer = false
    var onBuffer: ((AVAudioPCMBuffer) -> Void)?
    var onLevel: ((Float) -> Void)?

    func start() async throws {
        fputs("[system-audio] start requested\n", stderr)

        let hasPermission = CGPreflightScreenCaptureAccess()
        fputs("[system-audio] screen capture preflight: \(hasPermission)\n", stderr)

        if !hasPermission {
            fputs("[system-audio] requesting screen capture access\n", stderr)
            let granted = CGRequestScreenCaptureAccess()
            fputs("[system-audio] screen capture request result: \(granted)\n", stderr)
            guard granted else {
                throw AudioCaptureError.screenRecordingPermissionDenied
            }
        }

        guard CGPreflightScreenCaptureAccess() else {
            throw AudioCaptureError.screenRecordingPermissionDenied
        }

        let content = try await loadShareableContent(timeout: 5)
        fputs("[system-audio] shareable content: displays=\(content.displays.count) apps=\(content.applications.count) windows=\(content.windows.count)\n", stderr)

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = Int(sampleRate)
        config.channelCount = 1
        config.excludesCurrentProcessAudio = true
        // Audio-only stream. Adding a screen output can cause the capture
        // connection to be interrupted on some macOS/Electron dev setups.
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1) // 1 fps — we only want audio

        guard let display = content.displays.first else {
            throw AudioCaptureError.noDisplay
        }

        let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
        stream = SCStream(filter: filter, configuration: config, delegate: self)

        try stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global(qos: .userInitiated))
        try await stream?.startCapture()
        fputs("[system-audio] stream capture started\n", stderr)
        startNoAudioTimer()
    }

    func stop() async {
        noAudioTimer?.cancel()
        noAudioTimer = nil
        try? await stream?.stopCapture()
        stream = nil
        didLogFirstBuffer = false
        didLogDecodeFailure = false
        didStopBeforeFirstBuffer = false
    }

    // SCStreamOutput
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type != .screen else { return }
        guard type == .audio else { return }
        guard let buffer = sampleBuffer.asPCMBuffer() else {
            if !didLogDecodeFailure {
                didLogDecodeFailure = true
                fputs("[system-audio] failed to decode CMSampleBuffer into PCM\n", stderr)
            }
            return
        }

        if !didLogFirstBuffer {
            didLogFirstBuffer = true
            noAudioTimer?.cancel()
            noAudioTimer = nil
            fputs("[system-audio] first buffer: sampleRate=\(buffer.format.sampleRate) channels=\(buffer.format.channelCount) frames=\(buffer.frameLength) format=\(buffer.format.commonFormat.rawValue) interleaved=\(buffer.format.isInterleaved)\n", stderr)
        }

        onBuffer?(buffer)

        // RMS level
        if let channelData = buffer.floatChannelData?[0] {
            let frameLength = Int(buffer.frameLength)
            let samples = UnsafeBufferPointer(start: channelData, count: frameLength)
            let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(frameLength))
            onLevel?(min(rms * 10, 1.0))
        }
    }

    // SCStreamDelegate
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        noAudioTimer?.cancel()
        noAudioTimer = nil
        if !didLogFirstBuffer {
            didStopBeforeFirstBuffer = true
            fputs("[system-audio] stream stopped before first audio buffer: \(error)\n", stderr)
        }
        emitError(code: "STREAM_STOPPED", error.localizedDescription)
    }

    private func startNoAudioTimer() {
        noAudioTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: .global(qos: .utility))
        timer.schedule(deadline: .now() + 4)
        timer.setEventHandler { [weak self] in
            guard let self, !self.didLogFirstBuffer else { return }
            if self.didStopBeforeFirstBuffer { return }
            emitError(
                code: "SYSTEM_AUDIO_NO_BUFFERS",
                "Nenhum buffer de audio do computador chegou. Verifique permissao de Gravacao de Tela/Audio do Sistema para o binario AudioEngine/Electron e toque audio em outro app."
            )
            fputs("[system-audio] no audio buffers received after stream start\n", stderr)
        }
        noAudioTimer = timer
        timer.resume()
    }
}

// MARK: - Permission check

func loadShareableContent(timeout: TimeInterval) async throws -> SCShareableContent {
    try await withCheckedThrowingContinuation { continuation in
        let lock = NSLock()
        var didResume = false

        func resumeOnce(_ result: Result<SCShareableContent, Error>) {
            lock.lock()
            defer { lock.unlock() }
            guard !didResume else { return }
            didResume = true

            switch result {
            case .success(let content):
                continuation.resume(returning: content)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }

        SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: false) { content, error in
            if let content {
                resumeOnce(.success(content))
            } else if let error {
                fputs("[system-audio] shareable content failed: \(error)\n", stderr)
                resumeOnce(.failure(error))
            } else {
                resumeOnce(.failure(AudioCaptureError.shareableContentUnavailable))
            }
        }

        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout) {
            lock.lock()
            let shouldTimeout = !didResume
            lock.unlock()

            guard shouldTimeout else { return }
            fputs("[system-audio] shareable content timed out after \(timeout)s\n", stderr)
            resumeOnce(.failure(AudioCaptureError.shareableContentTimeout))
        }
    }
}

// MARK: - CMSampleBuffer → AVAudioPCMBuffer helper

extension CMSampleBuffer {
    func asPCMBuffer() -> AVAudioPCMBuffer? {
        guard let formatDesc = CMSampleBufferGetFormatDescription(self),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc)?.pointee
        else { return nil }

        var asbdCopy = asbd
        let format = AVAudioFormat(streamDescription: &asbdCopy)
            ?? AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!

        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(self))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return nil }
        buffer.frameLength = frameCount

        guard CMSampleBufferCopyPCMDataIntoAudioBufferList(
            self, at: 0, frameCount: Int32(frameCount),
            into: buffer.mutableAudioBufferList
        ) == noErr else { return nil }

        return buffer
    }
}
