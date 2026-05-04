// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AudioEngine",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AudioEngine",
            path: "Sources/AudioEngine",
            linkerSettings: [
                .linkedFramework("AVFoundation"),
                .linkedFramework("Speech"),
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("CoreGraphics"),
                .linkedFramework("CoreAudio"),
                .linkedFramework("AudioToolbox"),
            ]
        )
    ]
)
