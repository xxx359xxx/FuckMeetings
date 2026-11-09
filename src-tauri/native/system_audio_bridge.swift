import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreGraphics

public typealias AudioCallback = @convention(c) (UnsafePointer<Int16>?, Int32) -> Void
public typealias ErrorCallback = @convention(c) (UnsafePointer<CChar>?) -> Void

final class AudioOutput: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "com.den4iksoftware.fuckmeetings.system-audio")
    let path: URL?
    let audioCallback: AudioCallback?
    let errorCallback: ErrorCallback?
    var file: AVAudioFile?
    var converter: AVAudioConverter?
    var converterInput: AVAudioFormat?
    var failure: String?
    init(path: URL?, audioCallback: AudioCallback? = nil, errorCallback: ErrorCallback? = nil) {
        self.path = path; self.audioCallback = audioCallback; self.errorCallback = errorCallback
    }
    func report(_ message: String) {
        failure = message
        message.withCString { errorCallback?($0) }
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) { queue.async { self.report(error.localizedDescription) } }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio, CMSampleBufferDataIsReady(sampleBuffer), let desc = CMSampleBufferGetFormatDescription(sampleBuffer) else { return }
        let format = AVAudioFormat(cmAudioFormatDescription: desc)
        let frames = CMSampleBufferGetNumSamples(sampleBuffer)
        guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buffer.frameLength = AVAudioFrameCount(frames)
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0, frameCount: Int32(frames), into: buffer.mutableAudioBufferList)
        guard status == noErr else { report("Не удалось прочитать аудиоданные: \(status)"); return }
        if let audioCallback {
            guard let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true),
                  let converted = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: AVAudioFrameCount(ceil(Double(frames) * 16000 / format.sampleRate)) + 32) else {
                report("Не удалось подготовить преобразование системного звука"); return
            }
            if converter == nil || converterInput?.sampleRate != format.sampleRate || converterInput?.channelCount != format.channelCount || converterInput?.commonFormat != format.commonFormat {
                converter = AVAudioConverter(from: format, to: target)
                converterInput = format
            }
            guard let converter else { report("Не удалось подготовить преобразование системного звука"); return }
            var supplied = false
            var conversionError: NSError?
            _ = converter.convert(to: converted, error: &conversionError) { _, status in
                if supplied { status.pointee = .noDataNow; return nil }
                supplied = true; status.pointee = .haveData; return buffer
            }
            if let conversionError { report("Не удалось преобразовать системный звук: \(conversionError.localizedDescription)"); return }
            if converted.frameLength > 0, let samples = converted.int16ChannelData?.pointee {
                audioCallback(UnsafePointer(samples), Int32(converted.frameLength))
            }
            return
        }
        guard let path else { return }
        do {
            if file == nil {
                let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: format.sampleRate, AVNumberOfChannelsKey: Int(format.channelCount), AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
                file = try AVAudioFile(forWriting: path, settings: settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
            }
            try file?.write(from: buffer)
        } catch { report("Не удалось сохранить системный звук: \(error.localizedDescription)") }
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
    return startCapture(path: URL(fileURLWithPath: String(cString: path)), audioCallback: nil, errorCallback: nil, error: error, capacity: capacity)
}

@_cdecl("fm_audio_start_stream")
public func fmAudioStartStream(_ audioCallback: AudioCallback?, _ errorCallback: ErrorCallback?, _ error: UnsafeMutablePointer<CChar>?, _ capacity: Int32) -> Int32 {
    guard let audioCallback else { copyError("Не указан обработчик системного звука", error, capacity); return 1 }
    return startCapture(path: nil, audioCallback: audioCallback, errorCallback: errorCallback, error: error, capacity: capacity)
}

func startCapture(path: URL?, audioCallback: AudioCallback?, errorCallback: ErrorCallback?, error: UnsafeMutablePointer<CChar>?, capacity: Int32) -> Int32 {
    if !CGPreflightScreenCaptureAccess() && !CGRequestScreenCaptureAccess() {
        copyError("Разрешите запись экрана и системного звука для FuckMeetings в настройках macOS и перезапустите приложение.", error, capacity); return 1
    }
    let done = DispatchSemaphore(value: 0), result = ResultBox()
    let task = Task {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else { throw NSError(domain: "SystemAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "Не найден экран для системного захвата"]) }
            let output = AudioOutput(path: path, audioCallback: audioCallback, errorCallback: errorCallback)
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
