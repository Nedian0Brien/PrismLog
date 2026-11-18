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

/// The five colors PrismLog refracts light into, in the order a prism
/// spreads them: garnet (영화), persimmon (시리즈), amber (공부), jade (독서),
/// iris (게임).
///
/// v2 replaces the web's `CATEGORY_COLORS`. All five share one lightness and
/// chroma in OKLCH — `main` at L 0.68 C 0.12, `light` at L 0.82 C 0.09, hues
/// 22°/52°/85°/168°/282° — so no category shouts over another.
enum PrismAccent: String, CaseIterable, Identifiable, Hashable, Sendable {
    case reading
    case study
    case movie
    case series
    case game

    var id: String { rawValue }

    var tone: PrismTone {
        switch self {
        case .reading: PrismTone(main: Color(hex: 0x37B08A), light: Color(hex: 0x88D7B9), glowOpacity: 0.35)
        case .study:   PrismTone(main: Color(hex: 0xBA9232), light: Color(hex: 0xDFC07F), glowOpacity: 0.35)
        case .movie:   PrismTone(main: Color(hex: 0xD87876), light: Color(hex: 0xF9ADAA), glowOpacity: 0.35)
        case .series:  PrismTone(main: Color(hex: 0xD2824E), light: Color(hex: 0xF3B48E), glowOpacity: 0.35)
        case .game:    PrismTone(main: Color(hex: 0x8D8EE0), light: Color(hex: 0xBABDFE), glowOpacity: 0.35)
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

    /// The dashboard splits records three ways — 독서 / 공부 / 문화 — and reuses
    /// the movie red for the whole culture bucket, exactly as the web aliases
    /// `movie: culture` in its color table (`core.jsx:5`). Anywhere a count of
    /// *all* culture records is shown, this is the label; calling that number
    /// "영화" would be a lie whenever a series or game is in it.
    var dashboardLabel: String { self == .movie ? "문화" : label }
}

// MARK: - Neutral surface tokens

enum PrismColor {
    /// Base canvas. Everything else is light scattered on top of this.
    static let background = Color(hex: 0x1A1816)
    static let backgroundLift = Color(hex: 0x252220)
    static let surface = Color(hex: 0x282421)
    static let text = Color(hex: 0xF5F0EB)
    /// Lifted from the web's #A09890, which fell to 1.6:1 on glass over a
    /// bright wall (issue #19).
    static let textMuted = Color(hex: 0xC1BDB5)
    static let hairline = Color.white.opacity(0.07)

    /// The full spectrum sweep used for the wordmark and prism accents.
    static let spectrum = Gradient(colors: [
        PrismAccent.reading.color,
        PrismAccent.study.color,
        PrismAccent.movie.color,
    ])
}
