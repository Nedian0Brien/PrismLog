import SwiftUI

/// Every record in one chronological thread. Ported from `TimelinePage`
/// (`src/features/prismlog/pages/timelinePage.jsx`).
struct TimelineScreen: View {
    @Environment(PrismStore.self) private var store

    private struct Day: Identifiable {
        let date: Date
        let records: [RecordItem]

        var id: Date { date }
    }

    var body: some View {
        PrismScreenScaffold(
            eyebrow: "Timeline",
            title: "타임라인",
            focus: .movie,
            onRefresh: { await store.sync() }
        ) {
            if days.isEmpty {
                PrismGlassSection {
                    PrismPlaceholderCard(
                        accent: .movie,
                        title: store.hasLoadedOnce ? "기록이 없습니다" : "불러오는 중…",
                        detail: "기록을 남기면 발생한 시각 순서로 여기에 쌓입니다."
                    )
                }
            } else {
                PrismGlassSection {
                    VStack(alignment: .leading, spacing: 22) {
                        ForEach(days) { day in
                            VStack(alignment: .leading, spacing: 10) {
                                dayHeader(day)

                                ForEach(day.records) { record in
                                    NavigationLink(value: record.id) {
                                        RecordSummaryRow(record: record)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationDestination(for: UUID.self) { id in
            RecordDetailScreen(recordID: id)
        }
    }

    private func dayHeader(_ day: Day) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(day.date, format: .dateTime.day())
                .font(PrismFont.numeral(26, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)

            VStack(alignment: .leading, spacing: 1) {
                Text(day.date, format: .dateTime.year().month())
                    .font(.prismCaption)
                    .prismMuted()
                Text(day.date, format: .dateTime.weekday(.wide))
                    .font(.prismMicro)
                    .prismMuted()
            }

            Spacer(minLength: 0)

            Text("\(day.records.count)건")
                .font(.prismMicro)
                .prismMuted()
        }
        .padding(.horizontal, 4)
    }

    private var days: [Day] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: store.records) {
            calendar.startOfDay(for: $0.occurredAt)
        }

        return grouped
            .map { Day(date: $0.key, records: $0.value.sorted { $0.occurredAt > $1.occurredAt }) }
            .sorted { $0.date > $1.date }
    }
}

#Preview {
    TimelineScreen()
        .environment(PrismStore.preview())
}
