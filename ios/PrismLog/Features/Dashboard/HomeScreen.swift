import SwiftUI

struct HomeScreen: View {
    @Environment(PrismStore.self) private var store

    var body: some View {
        PrismScreenScaffold(
            eyebrow: "Dashboard",
            title: "기록 대시보드",
            focus: .reading,
            onRefresh: { await store.sync() }
        ) {
            PrismGlassSection {
                VStack(spacing: 14) {
                    statusBanner

                    countsCard

                    if !store.records.isEmpty {
                        recentSection
                    } else if store.hasLoadedOnce {
                        PrismPlaceholderCard(
                            accent: .reading,
                            title: "아직 기록이 없습니다",
                            detail: "오른쪽 아래 + 버튼으로 첫 기록을 남겨 보세요."
                        )
                    }
                }
            }
        }
    }

    // MARK: - Pieces

    @ViewBuilder
    private var statusBanner: some View {
        switch store.status {
        case .syncing where !store.hasLoadedOnce:
            HStack(spacing: 10) {
                ProgressView().controlSize(.small)
                Text("기록을 불러오는 중…").font(.prismCallout).prismMuted()
                Spacer(minLength: 0)
            }
            .prismGlassCard()

        case .offline:
            banner(icon: "wifi.slash", tint: .study, text: "오프라인 — 저장된 기록을 보고 있습니다.")

        case .failed(let message):
            banner(icon: "exclamationmark.triangle.fill", tint: .movie, text: "동기화 실패: \(message)")

        default:
            EmptyView()
        }
    }

    private func banner(icon: String, tint: PrismAccent, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tint.color)
            Text(text)
                .font(.prismCallout)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: tint.color)
    }

    private var countsCard: some View {
        VStack(spacing: 0) {
            ForEach(summaryRows, id: \.accent) { row in
                HStack(spacing: 12) {
                    Image(systemName: row.accent.symbol)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(row.accent.color)
                        .frame(width: 24)

                    Text(row.accent.label)
                        .font(.prismHeadline)
                        .foregroundStyle(PrismColor.text)

                    Spacer(minLength: 0)

                    Text(row.value)
                        .font(PrismFont.numeral(19, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(row.accent.color)
                }
                .padding(.vertical, 11)

                if row.accent != summaryRows.last?.accent {
                    Divider().overlay(PrismColor.hairline)
                }
            }
        }
        .prismGlassCard()
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("최근 기록")
                .font(.prismTitle)
                .foregroundStyle(PrismColor.text)
                .padding(.horizontal, 4)

            ForEach(store.records.prefix(5)) { record in
                RecordSummaryRow(record: record)
            }
        }
    }

    private var summaryRows: [(accent: PrismAccent, value: String)] {
        let reading = store.records(in: .reading)
        let study = store.records(in: .study)
        let culture = store.records(in: .culture)
        let studyHours = study.reduce(0) { $0 + $1.hours }

        return [
            (.reading, "\(reading.count)권"),
            (.study, studyHours > 0 ? "\(Int(studyHours))h" : "\(study.count)건"),
            (.movie, "\(culture.count)편"),
        ]
    }
}

#Preview {
    HomeScreen()
        .environment(PrismStore.preview())
}

/// Compact row used on the dashboard and the timeline.
struct RecordSummaryRow: View {
    let record: RecordItem

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(record.accent.color)
                .frame(width: 3.5, height: 34)

            VStack(alignment: .leading, spacing: 3) {
                Text(record.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(1)

                Text(subtitle)
                    .font(.prismCaption)
                    .prismMuted()
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            Text(record.occurredAt, format: .relative(presentation: .numeric))
                .font(.prismMicro)
                .prismMuted()
                .layoutPriority(1)
        }
        .prismGlassCard(tint: record.accent.color, padding: 14)
    }

    private var subtitle: String {
        switch record.category {
        case .reading:
            record.pagesTotal > 0
                ? "\(record.categoryLabel) · \(record.progress)% · \(record.pagesRead)/\(record.pagesTotal)p"
                : "\(record.categoryLabel) · \(record.progress)%"
        case .study:
            "\(record.categoryLabel) · \(record.progress)% 진행"
        default:
            [record.categoryLabel, record.status].compactMap { $0 }.joined(separator: " · ")
        }
    }
}
