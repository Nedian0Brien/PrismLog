import SwiftUI

// MARK: - Hex helper

extension Color {
    /// Creates a color from a 0xRRGGBB literal. Mirrors the web token format in
    /// `src/features/prismlog/core.jsx` so both platforms stay in sync by eye.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

// MARK: - Accent tones

/// One category's light. `main` is the identity color, `light` the highlight used
/// where glass thins out, `glow` the bloom that the background scatters.
struct PrismTone: Hashable, Sendable {
    let main: Color
    let light: Color
    let glowOpacity: Double

    var glow: Color { main.opacity(glowOpacity) }
}

/// The five colors PrismLog refracts light into. Ported from `CATEGORY_COLORS`
/// in `src/features/prismlog/core.jsx`.
enum PrismAccent: String, CaseIterable, Identifiable, Hashable, Sendable {
    case reading
    case study
    case movie
    case series
    case game

    var id: String { rawValue }

    var tone: PrismTone {
        switch self {
        case .reading: PrismTone(main: Color(hex: 0x2DB5A3), light: Color(hex: 0x3FD4BF), glowOpacity: 0.35)
        case .study:   PrismTone(main: Color(hex: 0xF0C930), light: Color(hex: 0xF7DA5E), glowOpacity: 0.35)
        case .movie:   PrismTone(main: Color(hex: 0xE63946), light: Color(hex: 0xF25D69), glowOpacity: 0.35)
        case .series:  PrismTone(main: Color(hex: 0xFF8A65), light: Color(hex: 0xFFAB91), glowOpacity: 0.35)
        case .game:    PrismTone(main: Color(hex: 0x7C9CF5), light: Color(hex: 0xA7BCFF), glowOpacity: 0.35)
        }
    }

    var color: Color { tone.main }

    /// Korean display label, matching the web UI.
    var label: String {
        switch self {
        case .reading: "독서"
        case .study: "공부"
        case .movie: "영화"
        case .series: "시리즈"
        case .game: "게임"
        }
    }

    var symbol: String {
        switch self {
        case .reading: "book.closed.fill"
        case .study: "pencil.and.outline"
        case .movie: "film.fill"
        case .series: "tv.fill"
        case .game: "gamecontroller.fill"
        }
    }
}

// MARK: - Neutral surface tokens

enum PrismColor {
    /// Base canvas. Everything else is light scattered on top of this.
    static let background = Color(hex: 0x1A1816)
    static let backgroundLift = Color(hex: 0x252220)
    static let surface = Color(hex: 0x282421)
    static let text = Color(hex: 0xF5F0EB)
    static let textMuted = Color(hex: 0xA09890)
    static let hairline = Color.white.opacity(0.07)

    /// The full spectrum sweep used for the wordmark and prism accents.
    static let spectrum = Gradient(colors: [
        PrismAccent.reading.color,
        PrismAccent.study.color,
        PrismAccent.movie.color,
    ])
}
