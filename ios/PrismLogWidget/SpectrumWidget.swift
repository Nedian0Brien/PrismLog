import SwiftUI
import WidgetKit

struct SpectrumEntry: TimelineEntry {
    let date: Date
    let snapshot: SpectrumSnapshot
}

struct SpectrumProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpectrumEntry {
        SpectrumEntry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SpectrumEntry) -> Void) {
        let snapshot = context.isPreview
            ? SpectrumSnapshot.placeholder
            : (SpectrumSnapshotStore.read() ?? .empty)
        completion(SpectrumEntry(date: .now, snapshot: snapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpectrumEntry>) -> Void) {
        let entry = SpectrumEntry(date: .now, snapshot: SpectrumSnapshotStore.read() ?? .empty)
        // The app reloads the timeline whenever data changes; this refresh is
        // only a floor so a widget left alone still catches up.
        let next = Calendar.current.date(byAdding: .hour, value: 4, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct SpectrumWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SpectrumEntry

    var body: some View {
        switch family {
        case .systemSmall: small
        default: medium
        }
    }

    private var small: some View {
        VStack(spacing: 8) {
            WidgetSpectrumRing(snapshot: entry.snapshot, diameter: 74, lineWidth: 9)
            Text(subtitle)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) { PrismColor.background }
    }

    private var medium: some View {
        HStack(spacing: 16) {
            WidgetSpectrumRing(snapshot: entry.snapshot, diameter: 82, lineWidth: 10)

            VStack(alignment: .leading, spacing: 7) {
                legend(.reading, count: entry.snapshot.reading, unit: "권")
                legend(.study, count: entry.snapshot.study, unit: "건")
                legend(.movie, count: entry.snapshot.culture, unit: "편")

                if let title = entry.snapshot.latestTitle {
                    Text(title)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .padding(.top, 2)
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) { PrismColor.background }
    }

    private func legend(_ accent: PrismAccent, count: Int, unit: String) -> some View {
        HStack(spacing: 7) {
            Circle()
                .fill(accent.color)
                .frame(width: 7, height: 7)

            Text(accent.label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.primary)

            Spacer(minLength: 4)

            Text("\(count)\(unit)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(accent.color)
        }
    }

    private var subtitle: String {
        entry.snapshot.streakDays > 0 ? "\(entry.snapshot.streakDays)일 연속" : "오늘의 기록"
    }
}

/// A trimmed-down ring for the widget: no glass lens, no entrance animation —
/// widgets render once, and the lens would just read as grey at this size.
struct WidgetSpectrumRing: View {
    let snapshot: SpectrumSnapshot
    var diameter: CGFloat
    var lineWidth: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.09), lineWidth: lineWidth)

            ForEach(arcs, id: \.accent) { arc in
                Circle()
                    .trim(from: arc.start, to: arc.end)
                    .stroke(arc.accent.color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }

            VStack(spacing: 0) {
                Text("\(snapshot.total)")
                    .font(.system(size: diameter * 0.28, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                Text("기록")
                    .font(.system(size: diameter * 0.12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: diameter, height: diameter)
        .accessibilityLabel("전체 기록 \(snapshot.total)건")
    }

    private struct Arc {
        let accent: PrismAccent
        let start: CGFloat
        let end: CGFloat
    }

    private var arcs: [Arc] {
        let slices: [(PrismAccent, Int)] = [
            (.reading, snapshot.reading),
            (.study, snapshot.study),
            (.movie, snapshot.culture),
        ]
        let total = slices.reduce(0) { $0 + $1.1 }
        guard total > 0 else { return [] }

        let gap: CGFloat = slices.filter { $0.1 > 0 }.count > 1 ? 0.014 : 0
        var cursor: CGFloat = 0

        return slices.compactMap { accent, count in
            guard count > 0 else { return nil }
            let start = cursor
            cursor += CGFloat(count) / CGFloat(total)
            return Arc(accent: accent, start: start, end: max(start, cursor - gap))
        }
    }
}

struct PrismSpectrumWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PrismSpectrumWidget", provider: SpectrumProvider()) { entry in
            SpectrumWidgetView(entry: entry)
        }
        .configurationDisplayName("스펙트럼")
        .description("독서·공부·문화 기록 비율을 한눈에.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct PrismLogWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrismSpectrumWidget()
    }
}
