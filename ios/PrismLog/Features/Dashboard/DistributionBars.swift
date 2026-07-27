import SwiftUI

/// Cumulative record counts as bars scaled to the largest category. Ported from
/// `DistributionBarChart` (`src/features/prismlog/ui.jsx:610`).
///
/// Unlike the ring, which shows proportion, this answers "how much of each?" —
/// the two read very differently once one category dominates.
struct DistributionBars: View {
    let counts: [PrismAccent: Int]
    let enabled: Set<PrismAccent>

    private let order: [PrismAccent] = [.reading, .study, .movie]

    var body: some View {
        let active = order.filter(enabled.contains)

        if active.isEmpty {
            Text("표시할 카테고리를 선택해 주세요.")
                .font(.prismCaption)
                .prismMuted()
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            let maxValue = max(1, active.map { counts[$0] ?? 0 }.max() ?? 1)

            VStack(spacing: 12) {
                ForEach(active, id: \.self) { accent in
                    bar(accent, value: counts[accent] ?? 0, maxValue: maxValue)
                }
            }
        }
    }

    private func bar(_ accent: PrismAccent, value: Int, maxValue: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(accent.dashboardLabel)
                    .font(.prismCaption)
                    .foregroundStyle(accent.color)

                Spacer(minLength: 0)

                Text("\(value)")
                    .font(PrismFont.numeral(13, weight: .semibold))
                    .monospacedDigit()
                    .prismMuted()
            }

            ProgressMeter(
                value: Double(value) / Double(maxValue),
                accent: accent,
                height: 8
            )
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(accent.dashboardLabel) \(value)건")
    }
}
