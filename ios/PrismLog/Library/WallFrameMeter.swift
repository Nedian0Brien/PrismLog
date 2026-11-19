#if DEBUG
import Observation
import QuartzCore
import UIKit

/// Measures frame pacing in the debug lab: hitch time per second of
/// animation, the metric spec §9 budgets (< 5 ms/s).
///
/// Instruments' display and hitch instruments return no data for an iOS
/// 27.3 device recorded from Xcode 27.2, so the lab measures it in-app. A
/// frame's hitch time is how much later than its expected interval it
/// arrived — the same definition Instruments uses.
@Observable
@MainActor
final class WallFrameMeter: NSObject {
    private(set) var hitchMillisecondsPerSecond: Double = 0
    private(set) var framesPerSecond: Double = 0

    private var link: CADisplayLink?
    private var lastTimestamp: CFTimeInterval?
    private var windowStart: CFTimeInterval?
    private var windowFrames = 0
    private var windowHitch: CFTimeInterval = 0
    /// Seconds per report. Long enough to average out one-off hitches.
    private let window: CFTimeInterval = 5
    var label = ""

    func start() {
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    func stop() {
        link?.invalidate()
        link = nil
        lastTimestamp = nil
        windowStart = nil
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let expected = link.targetTimestamp - link.timestamp
        defer { lastTimestamp = now }
        guard let last = lastTimestamp else {
            windowStart = now
            return
        }

        windowFrames += 1
        // Late by more than half a frame counts as a hitch, as in Instruments.
        let late = (now - last) - expected
        if late > expected / 2 { windowHitch += late }

        guard let start = windowStart, now - start >= window else { return }
        let elapsed = now - start
        hitchMillisecondsPerSecond = windowHitch * 1000 / elapsed
        framesPerSecond = Double(windowFrames) / elapsed
        let footprint = Double(Self.physicalFootprint()) / 1_048_576
        print("[WallMeter] \(label) hitch=\(String(format: "%.2f", hitchMillisecondsPerSecond))ms/s fps=\(String(format: "%.1f", framesPerSecond)) footprint=\(String(format: "%.1f", footprint))MB")
        windowStart = now
        windowFrames = 0
        windowHitch = 0
    }

    /// The app's memory as the system counts it (what Xcode's gauge shows).
    static func physicalFootprint() -> UInt64 {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        return result == KERN_SUCCESS ? info.phys_footprint : 0
    }
}
#endif
