import SwiftUI

/// Five weeks of activity. Colored by the selected category so the grid answers
/// "when do I actually read?" rather than just "was I busy?".
struct ActivityHeatmap: View {
    let weeks: [[DashboardMetrics.HeatmapCell]]
    var accent: PrismAccent?

    private let labels = ["월", "화", "수", "목", "금", "토", "일"]
    private let cell: CGFloat = 30
    private let spacing: CGFloat = 5

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            HStack(spacing: spacing) {
                ForEach(labels, id: \.self) { label in
                    Text(label)
                        .font(.prismMicro)
                        .prismMuted()
                        .frame(width: cell)
                }
            }

            ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                HStack(spacing: spacing) {
                    ForEach(week) { day in
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(fill(for: day))
                            .frame(width: cell, height: cell)
                            .overlay {
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .stroke(PrismColor.hairline, lineWidth: day.isFuture ? 0 : 1)
                            }
                            .opacity(day.isFuture ? 0.25 : 1)
                            .accessibilityLabel(Text(day.date, format: .dateTime.month().day()))
                            .accessibilityValue("\(day.count)건")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func fill(for day: DashboardMetrics.HeatmapCell) -> Color {
        let level = DashboardMetrics.intensity(for: day.count)
        guard level > 0 else { return Color.white.opacity(0.045) }

        let base = accent?.color ?? PrismAccent.reading.color
        return base.opacity([0, 0.28, 0.52, 0.8][level])
    }
}
