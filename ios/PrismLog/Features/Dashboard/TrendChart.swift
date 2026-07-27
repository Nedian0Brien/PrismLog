import Charts
import SwiftUI

/// How far back the trend looks. Two weeks matches the web, but records arrive
/// in bursts months apart — on the live data a fortnight window holds nothing at
/// all and even a quarter holds one record, so a year is the default.
enum TrendRange: Int, CaseIterable, Identifiable, Sendable {
    case twoWeeks = 14
    case threeMonths = 90
    case year = 365

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .twoWeeks: "2주"
        case .threeMonths: "3개월"
        case .year: "1년"
        }
    }

    /// Days between x-axis labels, so they never collide.
    var axisStride: Int {
        switch self {
        case .twoWeeks: 4
        case .threeMonths: 21
        case .year: 90
        }
    }
}

/// Activity trend. Categories can be toggled off so a busy stretch in one area
/// doesn't flatten the others.
struct TrendChart: View {
    let points: [DashboardMetrics.DayPoint]
    let enabled: Set<PrismAccent>
    var range: TrendRange = .threeMonths

    private let series: [PrismAccent] = [.reading, .study, .movie]

    var body: some View {
        Chart {
            // One `series` per category, otherwise Charts joins every point into
            // a single path and draws a line straight through the baseline.
            // Lines only: three translucent areas stacked on top of each other
            // turn to mud, and `.monotone` keeps cumulative counts from
            // overshooting below zero the way `.catmullRom` does on sparse data.
            ForEach(series.filter(enabled.contains), id: \.self) { accent in
                ForEach(points) { point in
                    LineMark(
                        x: .value("날짜", point.date, unit: .day),
                        y: .value("기록", point.count(for: accent)),
                        series: .value("카테고리", accent.label)
                    )
                    .foregroundStyle(accent.color)
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                }
            }
        }
        .chartLegend(.hidden)
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: range.axisStride)) { _ in
                AxisValueLabel(format: .dateTime.month(.defaultDigits).day())
                    .foregroundStyle(PrismColor.textMuted)
                    .font(.prismMicro)
                AxisGridLine().foregroundStyle(PrismColor.hairline)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) {
                AxisValueLabel()
                    .foregroundStyle(PrismColor.textMuted)
                    .font(.prismMicro)
                AxisGridLine().foregroundStyle(PrismColor.hairline)
            }
        }
        .frame(height: 160)
        .accessibilityLabel("최근 \(range.label) 기록 추세")
    }
}

/// Pill toggles for the chart's series. Ported from `CategoryToggleChips`.
struct CategoryToggleChips: View {
    @Binding var enabled: Set<PrismAccent>
    var options: [PrismAccent] = [.reading, .study, .movie]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { accent in
                let isOn = enabled.contains(accent)

                Button {
                    withAnimation(PrismMotion.snappy) {
                        if isOn { enabled.remove(accent) } else { enabled.insert(accent) }
                    }
                } label: {
                    Text(accent.dashboardLabel)
                        .font(.prismCaption)
                        .foregroundStyle(isOn ? accent.color : PrismColor.textMuted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background {
                            Capsule().fill(accent.color.opacity(isOn ? 0.16 : 0.04))
                        }
                        .overlay {
                            Capsule().stroke(
                                isOn ? accent.color.opacity(0.55) : PrismColor.hairline,
                                lineWidth: 1
                            )
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(accent.dashboardLabel)
                .accessibilityValue(isOn ? "표시" : "숨김")
                .accessibilityIdentifier("trend.toggle.\(accent.rawValue)")
            }

            Spacer(minLength: 0)
        }
    }
}
