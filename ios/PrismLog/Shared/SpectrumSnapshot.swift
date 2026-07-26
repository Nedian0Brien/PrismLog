import Foundation

/// The slice of state the widget needs, written by the app after every sync.
///
/// The widget reads a plain JSON file in the shared App Group rather than
/// opening the SwiftData store: a widget process touching the same store is a
/// migration and locking hazard for a payload this small.
struct SpectrumSnapshot: Codable, Sendable, Equatable {
    var reading: Int
    var study: Int
    var culture: Int
    var streakDays: Int
    var latestTitle: String?
    var updatedAt: Date

    var total: Int { reading + study + culture }

    static let placeholder = SpectrumSnapshot(
        reading: 9,
        study: 16,
        culture: 14,
        streakDays: 3,
        latestTitle: "무너지는 제국",
        updatedAt: .now
    )

    static let empty = SpectrumSnapshot(
        reading: 0,
        study: 0,
        culture: 0,
        streakDays: 0,
        latestTitle: nil,
        updatedAt: .distantPast
    )
}

enum SpectrumSnapshotStore {
    static let appGroupID = "group.kr.lawdigest.prismlog"
    private static let filename = "spectrum-snapshot.json"

    static var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupID)?
            .appendingPathComponent(filename)
    }

    static func write(_ snapshot: SpectrumSnapshot) {
        guard let fileURL, let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }

    static func read() -> SpectrumSnapshot? {
        guard let fileURL, let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(SpectrumSnapshot.self, from: data)
    }
}
