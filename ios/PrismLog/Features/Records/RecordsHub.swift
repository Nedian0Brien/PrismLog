import SwiftUI

// MARK: - Model

/// One shelf on the records hub. Mirrors the `sections` array in
/// `src/features/prismlog/pages/recordsPage.jsx:5550` — same labels, same units,
/// same three-item preview.
struct RecordSection: Identifiable, Hashable {
    struct Preview: Identifiable, Hashable {
        let id: UUID
        let title: String
        let coverURL: URL?
    }

    let accent: PrismAccent
    let detail: String
    /// Counting word. Books are 권, films 편 — using a single unit would read
    /// as machine-translated Korean.
    let unit: String
    let count: Int
    let latestUpdatedAt: Date?
    /// Tie-breaker when two shelves were last touched at the same moment, so
    /// the order stays stable instead of shuffling between renders.
    let order: Int
    let previews: [Preview]

    var id: String { accent.rawValue }

    @MainActor
    static func sections(from store: PrismStore) -> [RecordSection] {
        let reading = store.records(in: .reading)
        let studyGroups = StudyGrouping.groups(from: store.records(in: .study))
        let culture = store.records(in: .culture)
        let movies = culture.filter { $0.cultureType == .movie }
        let series = culture.filter { $0.cultureType == .series }
        let games = culture.filter { $0.cultureType == .game }

        return [
            section(.reading, "표지와 진행률", unit: "권", order: 0, records: reading),
            RecordSection(
                accent: .study,
                detail: "진척률과 챕터",
                unit: "개",
                count: studyGroups.count,
                latestUpdatedAt: studyGroups.first?.occurredAt,
                order: 1,
                previews: studyGroups.prefix(3).map {
                    Preview(id: $0.id, title: $0.title, coverURL: $0.coverURL)
                }
            ),
            section(.movie, "포스터와 평점", unit: "편", order: 2, records: movies),
            section(.series, "회차와 상태", unit: "편", order: 3, records: series),
            section(.game, "플레이 시간", unit: "개", order: 4, records: games),
        ]
        .sorted {
            let left = $0.latestUpdatedAt ?? .distantPast
            let right = $1.latestUpdatedAt ?? .distantPast
            return left == right ? $0.order < $1.order : left > right
        }
    }

    private static func section(
        _ accent: PrismAccent,
        _ detail: String,
        unit: String,
        order: Int,
        records: [RecordItem]
    ) -> RecordSection {
        RecordSection(
            accent: accent,
            detail: detail,
            unit: unit,
            count: records.count,
            latestUpdatedAt: records.first?.occurredAt,
            order: order,
            previews: records.prefix(3).map {
                Preview(id: $0.id, title: $0.title, coverURL: $0.coverURL)
            }
        )
    }
}

// MARK: - Card

/// The hub tile: identity at the top, a fanned stack of the three most recent
/// covers at the bottom, and — in single-column — the titles trailing off into
/// blur behind them, as though the rest of the shelf were out of focus.
struct RecordAreaCard: View {
    let section: RecordSection
    let singleColumn: Bool
    let action: () -> Void

    private var accent: Color { section.accent.color }

    // Taken from the web card so the two builds line up side by side.
    private var previewSize: CGSize { singleColumn ? CGSize(width: 88, height: 120) : CGSize(width: 58, height: 80) }
    private var previewStep: CGFloat { singleColumn ? 42 : 28 }
    private var stackHeight: CGFloat { singleColumn ? 122 : 84 }
    private var minimumHeight: CGFloat { singleColumn ? 222 : 188 }
    private var bleed: [CGFloat] { singleColumn ? [26, 20, 26] : [18, 12, 18] }

    private let rotations: [Double] = [-7, 0, 7]
    private let depths: [Double] = [2, 3, 1]

    var body: some View {
        Button(action: action) {
            // A clear spacer sets the card height and the two overlays pin to
            // its edges. A VStack with a `Spacer` would not do it: nothing
            // proposes the taller height down to the stack, so the spacer
            // collapses and the cover fan stops short of the card's edge.
            Color.clear
                .frame(maxWidth: .infinity)
                .frame(height: minimumHeight - 28)
                .overlay(alignment: .topLeading) { header }
                .overlay(alignment: .bottomLeading) { previewStack }
                .padding(14)
            // Drawn over the glass, not under it: this wash is what carries the
            // category's identity when the surface behind is nearly black.
            .background(wash)
            // Clips the fanned covers where they run past the card edge — the
            // overhang is the effect, the crop is what keeps it a card.
            .clipShape(RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous))
            // Untinted on purpose. The wash above already carries the exact
            // accent the web uses; tinting the glass underneath as well stacks
            // two colorings and turns the card into a solid slab of category
            // color instead of a dark surface with a hint of one.
            .glassEffect(.regular, in: .rect(cornerRadius: PrismGlassMetrics.cardCorner))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(section.accent.label), \(section.count)\(section.unit)")
        .accessibilityHint("탭하면 \(section.accent.label) 기록을 봅니다")
        .accessibilityIdentifier("records.area.\(section.accent.rawValue)")
    }

    private var wash: some View {
        RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color.white.opacity(0.04), accent.opacity(0.07)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay {
                RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [accent.opacity(0.15), .clear],
                            center: .topTrailing,
                            startRadius: 0,
                            endRadius: 190
                        )
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous)
                    .stroke(accent.opacity(0.18), lineWidth: 1)
            }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(accent.opacity(0.11))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(accent.opacity(0.19), lineWidth: 1)
                }
                .overlay {
                    Image(systemName: section.accent.symbol)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(accent)
                }
                .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 3) {
                Text(section.accent.label)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(1)

                Text(section.detail)
                    .font(.prismCaption)
                    .prismMuted()
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            HStack(alignment: .firstTextBaseline, spacing: 1) {
                Text("\(section.count)")
                    .font(PrismFont.numeral(singleColumn ? 30 : 24, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)

                Text(section.unit)
                    .font(PrismFont.numeral(singleColumn ? 15 : 13, weight: .bold))
                    .foregroundStyle(accent)
            }
            .layoutPriority(1)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    // MARK: Preview stack

    private var previewStack: some View {
        ZStack(alignment: .bottomLeading) {
            // Laid out so the middle cover sits in front — a hand of cards,
            // not a staircase. Web order: [1, 0, 2] with z-index 2/3/1.
            ForEach(Array(arranged.enumerated()), id: \.element.id) { index, preview in
                CoverImage(url: preview.coverURL, accent: section.accent, cornerRadius: 14)
                    .frame(width: previewSize.width, height: previewSize.height)
                    .shadow(color: .black.opacity(0.24), radius: 10, y: 6)
                    .rotationEffect(.degrees(rotations[index]), anchor: .center)
                    .offset(x: previewStep * CGFloat(index), y: bleed[index])
                    .zIndex(depths[index])
            }

            if section.previews.isEmpty {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(accent.opacity(0.26), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    .background {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(accent.opacity(0.06))
                    }
                    .overlay {
                        Image(systemName: section.accent.symbol)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    .frame(width: singleColumn ? 74 : 62, height: singleColumn ? 74 : 62)
                    .offset(y: singleColumn ? 10 : 6)
            }
        }
        .frame(maxWidth: .infinity, minHeight: stackHeight, alignment: .bottomLeading)
        .overlay(alignment: .bottomTrailing) {
            if singleColumn { recentTitles }
        }
    }

    private var arranged: [RecordSection.Preview] {
        let order: [Int] = switch section.previews.count {
        case 0: []
        case 1: [0]
        case 2: [1, 0]
        default: [1, 0, 2]
        }
        return order.map { section.previews[$0] }
    }

    /// Titles receding into the background — each line dimmer and softer than
    /// the one above it, so the shelf reads as deeper than the three covers
    /// showing.
    private var recentTitles: some View {
        VStack(alignment: .trailing, spacing: 4) {
            ForEach(Array(section.previews.enumerated()), id: \.element.id) { index, preview in
                Text(preview.title)
                    .font(.prismCaption)
                    .foregroundStyle(titleColor(index))
                    .opacity(titleOpacity(index))
                    .blur(radius: index == 0 ? 0 : 0.15 + Double(index) * 0.18)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            if remainingCount > 0 {
                Text("그리고 \(remainingCount)건의 기록들")
                    .font(.prismMicro)
                    .foregroundStyle(PrismColor.textMuted.opacity(0.78))
                    .opacity(0.62)
                    .blur(radius: 0.85)
                    .lineLimit(1)
            }
        }
        .frame(width: 150, alignment: .trailing)
        .multilineTextAlignment(.trailing)
        .padding(.trailing, 4)
        .padding(.bottom, 8)
        .allowsHitTesting(false)
    }

    private var remainingCount: Int { max(section.count - section.previews.count, 0) }

    private func titleColor(_ index: Int) -> Color {
        switch index {
        case 0: PrismColor.text
        case 1: PrismColor.text.opacity(0.74)
        default: PrismColor.textMuted
        }
    }

    private func titleOpacity(_ index: Int) -> Double {
        switch index {
        case 0: 1
        case 1: 0.9
        default: 0.72
        }
    }
}
