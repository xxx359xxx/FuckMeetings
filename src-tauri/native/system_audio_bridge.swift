import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreGraphics

final class AudioOutput: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "com.interviewkit.system-audio")
    let path: URL
    var file: AVAudioFile?
    var failure: String?
    init(path: URL) { self.path = path }
    func stream(_ stream: SCStream, didStopWithError error: Error) { queue.async { self.failure = error.localizedDescription } }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio, CMSampleBufferDataIsReady(sampleBuffer), let desc = CMSampleBufferGetFormatDescription(sampleBuffer) else { return }
        let format = AVAudioFormat(cmAudioFormatDescription: desc)
        let frames = CMSampleBufferGetNumSamples(sampleBuffer)
        guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buffer.frameLength = AVAudioFrameCount(frames)
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0, frameCount: Int32(frames), into: buffer.mutableAudioBufferList)
        guard status == noErr else { failure = "Не удалось прочитать аудиоданные: \(status)"; return }
        do {
            if file == nil {
                let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: format.sampleRate, AVNumberOfChannelsKey: Int(format.channelCount), AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
                file = try AVAudioFile(forWriting: path, settings: settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
            }
            try file?.write(from: buffer)
        } catch { failure = "Не удалось сохранить системный звук: \(error.localizedDescription)" }
    }
}
final class Session: @unchecked Sendable {
    let stream: SCStream
    let output: AudioOutput
    init(_ stream: SCStream, _ output: AudioOutput) { self.stream = stream; self.output = output }
}
final class Shared: @unchecked Sendable {
    static let instance = Shared()
    let lock = NSLock()
    var session: Session?
}
final class ResultBox: @unchecked Sendable { var error: String? }
func copyError(_ message: String, _ buffer: UnsafeMutablePointer<CChar>?, _ capacity: Int32) {
    guard let buffer = buffer, capacity > 0 else { return }
    message.withCString { source in _ = strlcpy(buffer, source, Int(capacity)) }
}

@_cdecl("fm_audio_start")
public func fmAudioStart(_ path: UnsafePointer<CChar>?, _ error: UnsafeMutablePointer<CChar>?, _ capacity: Int32) -> Int32 {
    guard let path else { copyError("Не указан путь записи", error, capacity); return 1 }
    if !CGPreflightScreenCaptureAccess() && !CGRequestScreenCaptureAccess() {
        copyError("Разрешите запись экрана и системного звука для FuckMeetings в настройках macOS и перезапустите приложение.", error, capacity); return 1
    }
    let target = URL(fileURLWithPath: String(cString: path))
    let done = DispatchSemaphore(value: 0), result = ResultBox()
    let task = Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else { throw NSError(domain: "SystemAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Не найден экран для системного захвата"]) }
            let output = AudioOutput(path: target)
            let config = SCStreamConfiguration()
            config.capturesAudio = true; config.excludesCurrentProcessAudio = true
            config.sampleRate = 48000; config.channelCount = 2
            config.width = 2; config.height = 2; config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
            let stream = SCStream(filter: SCContentFilter(display: display, excludingWindows: []), configuration: config, delegate: output)
            try stream.addStreamOutput(output, type: .audio, sampleHandlerQueue: output.queue)
            try await stream.startCapture()
            if Task.isCancelled { try? await stream.stopCapture(); result.error = "Запуск записи отменён" }
            else { Shared.instance.lock.lock(); Shared.instance.session = Session(stream, output); Shared.instance.lock.unlock() }
        } catch { result.error = error.localizedDescription }
        done.signal()
    }
    if done.wait(timeout: .now() + 60) == .timedOut { task.cancel(); copyError("Время ожидания запуска системного звука истекло", error, capacity); return 1 }
    if let message = result.error { copyError(message, error, capacity); return 1 }
    return 0
}

@_cdecl("fm_audio_stop")
public func fmAudioStop(_ error: UnsafeMutablePointer<CChar>?, _ capacity: Int32) -> Int32 {
    Shared.instance.lock.lock(); let session = Shared.instance.session; Shared.instance.session = nil; Shared.instance.lock.unlock()
    guard let session else { copyError("Запись системного звука не запущена", error, capacity); return 1 }
    let done = DispatchSemaphore(value: 0), result = ResultBox()
    Task {
        do { try await session.stream.stopCapture() } catch { result.error = error.localizedDescription }
        session.output.queue.sync { session.output.file = nil; if let error = session.output.failure { result.error = error } }
        done.signal()
    }
    if done.wait(timeout: .now() + 30) == .timedOut { copyError("Время ожидания завершения системного звука истекло", error, capacity); return 1 }
    if let message = result.error { copyError(message, error, capacity); return 1 }
    return 0
}
