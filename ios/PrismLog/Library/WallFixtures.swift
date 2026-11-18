#if DEBUG
import SwiftUI
import UIKit

/// Covers the debug lab can put on the wall instead of the user's library.
enum WallFixtureSource: String, CaseIterable, Identifiable {
    /// The user's own records.
    case library
    /// No covers at all — the wall falls back to the bloom (spec §4.1).
    case empty
    /// Ten near-white covers — the hardest case for text on glass (spec §4.7).
    case worstCase
    /// 30 and 200 synthetic covers for the performance budget (spec §9).
    case synthetic5
    case synthetic30
    case synthetic200

    var id: String { rawValue }

    var label: String {
        switch self {
        case .library: "내 기록"
        case .empty: "0장"
        case .worstCase: "최악 조건"
        case .synthetic5: "합성 5"
        case .synthetic30: "합성 30"
        case .synthetic200: "합성 200"
        }
    }
}

@MainActor
enum WallFixtures {
    /// Covers and decoded images for `source`, or `nil` for the library.
    static func make(_ source: WallFixtureSource, maxPixel: Int) -> ([WallCover], [WallCover.ID: UIImage])? {
        switch source {
        case .library: nil
        case .empty: ([], [:])
        case .worstCase: worstCase(maxPixel: maxPixel)
        case .synthetic5: synthetic(count: 5, maxPixel: maxPixel)
        case .synthetic30: synthetic(count: 30, maxPixel: maxPixel)
        case .synthetic200: synthetic(count: 200, maxPixel: maxPixel)
        }
    }

    private static let accents = WallComposition.rowOrder

    /// Mostly-white jackets with thin dark type, like a lot of real Korean
    /// paperback covers — the case the legibility layer has to win.
    private static func worstCase(maxPixel: Int) -> ([WallCover], [WallCover.ID: UIImage]) {
        let titles = ["빈 페이지", "여백의 기술", "하얀 방", "설원", "종이의 시간",
                      "흰 고래", "백지", "눈 내리는 밤", "빛의 해부학", "무채색"]
        var covers: [WallCover] = []
        var images: [WallCover.ID: UIImage] = [:]
        for (index, title) in titles.enumerated() {
            let accent = accents[index % accents.count]
            let cover = WallCover(
                id: "fixture-white-\(index)",
                accent: accent,
                title: title,
                coverURL: nil,
                lastActivity: Date(timeIntervalSinceNow: TimeInterval(-index * 3_600))
            )
            covers.append(cover)
            images[cover.id] = render(WhiteJacket(title: title, accent: accent, variant: index), maxPixel: maxPixel)
        }
        return (covers, images)
    }

    private static func synthetic(count: Int, maxPixel: Int) -> ([WallCover], [WallCover.ID: UIImage]) {
        var covers: [WallCover] = []
        var images: [WallCover.ID: UIImage] = [:]
        for index in 0..<count {
            let accent = accents[index % accents.count]
            let title = "합성 표지 \(String(format: "%03d", index + 1))"
            let cover = WallCover(
                id: "fixture-synthetic-\(index)",
                accent: accent,
                title: title,
                coverURL: nil,
                lastActivity: Date(timeIntervalSinceNow: TimeInterval(-index * 3_600))
            )
            covers.append(cover)
            images[cover.id] = GeneratedCover.render(accent: accent, title: title, maxPixel: maxPixel)
        }
        return (covers, images)
    }

    private static func render(_ view: some View, maxPixel: Int) -> UIImage? {
        let height = CGFloat(maxPixel)
        let renderer = ImageRenderer(
            content: view.frame(width: (height * GeneratedCover.aspectRatio).rounded(), height: height)
        )
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

private struct WhiteJacket: View {
    let title: String
    let accent: PrismAccent
    let variant: Int

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .topLeading) {
                Color(white: variant.isMultiple(of: 2) ? 0.98 : 0.94)
                Rectangle()
                    .fill(accent.color.opacity(0.7))
                    .frame(height: width * 0.012)
                    .offset(y: width * 0.62)
                Text(title)
                    .font(.custom(PrismFont.Weight.regular.rawValue, fixedSize: width * 0.085))
                    .foregroundStyle(Color(white: 0.2))
                    .padding(width * 0.1)
            }
        }
    }
}
#endif
