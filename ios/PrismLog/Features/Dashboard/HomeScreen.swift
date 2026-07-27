import SwiftUI

struct HomeScreen: View {
    @Environment(PrismStore.self) private var store

    @State private var trendCumulative = true
    @State private var trendRange: TrendRange = .year
    @State private var trendEnabled: Set<PrismAccent> = [.reading, .study, .movie]
    @State private var distributionEnabled: Set<PrismAccent> = [.reading, .study, .movie]
    @State private var heatmapAccent: PrismAccent?

    var body: some View {
        PrismScreenScaffold(
            eyebrow: todayLabel,
            title: "기록 대시보드",
            focus: .reading,
            onRefresh: { await store.sync() }
        ) {
            PrismGlassSection {
                VStack(spacing: 14) {
                    statusBanner
                    spectrumCard
                    trendCard
                    distributionCard
                    heatmapCard
                    recentSection
                }
            }
        }
    }

    // MARK: - Spectrum

    private var spectrumCard: some View {
        HStack(spacing: 16) {
            SpectrumRing(slices: slices, diameter: 150, lineWidth: 13)

            VStack(spacing: 0) {
                ForEach(Array(slices.enumerated()), id: \.element.id) { index, slice in
                    HStack(spacing: 10) {
                        Image(systemName: slice.accent.symbol)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(slice.accent.color)
                            .frame(width: 20)

                        Text(slice.accent.dashboardLabel)
                            .font(.prismCallout)
                            .foregroundStyle(PrismColor.text)

                        Spacer(minLength: 0)

                        Text(summaryValue(for: slice))
                            .font(PrismFont.numeral(17, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(slice.accent.color)
                    }
                    .padding(.vertical, 9)

                    if index < slices.count - 1 {
                        Divider().overlay(PrismColor.hairline)
                    }
                }
            }
        }
        .prismGlassCard(padding: 18)
    }

    // MARK: - Trend

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("추세선")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                Picker("표시 방식", selection: $trendCumulative) {
                    Text("누적").tag(true)
                    Text("일간").tag(false)
                }
                .pickerStyle(.segmented)
                .frame(width: 116)
            }

            Picker("기간", selection: $trendRange) {
                ForEach(TrendRange.allCases) { range in
                    Text(range.label).tag(range)
                }
            }
            .pickerStyle(.segmented)

            CategoryToggleChips(enabled: $trendEnabled)

            if trendEnabled.isEmpty {
                emptyNote("표시할 카테고리를 선택해 주세요.")
                    .frame(height: 160)
            } else {
                TrendChart(
                    points: DashboardMetrics.trend(
                        from: store.records,
                        days: trendRange.rawValue,
                        cumulative: trendCumulative
                    ),
                    enabled: trendEnabled,
                    range: trendRange
                )
            }
        }
        .prismGlassCard()
    }

    // MARK: - Distribution

    private var distributionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("전체 분포")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                Text("누적 기록 수")
                    .font(.prismMicro)
                    .prismMuted()
            }

            CategoryToggleChips(enabled: $distributionEnabled)

            DistributionBars(
                counts: [
                    .reading: store.records(in: .reading).count,
                    .study: store.records(in: .study).count,
                    .movie: store.records(in: .culture).count,
                ],
                enabled: distributionEnabled
            )
        }
        .prismGlassCard()
    }

    // MARK: - Heatmap

    private var heatmapCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("기록 히트맵")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                Text("최근 5주")
                    .font(.prismMicro)
                    .prismMuted()
            }

            HStack(spacing: 8) {
                heatmapChip(nil, label: "전체")
                heatmapChip(.reading, label: PrismAccent.reading.label)
                heatmapChip(.study, label: PrismAccent.study.label)
                heatmapChip(.movie, label: PrismAccent.movie.dashboardLabel)
                Spacer(minLength: 0)
            }

            ActivityHeatmap(
                weeks: DashboardMetrics.heatmap(from: store.records, accent: heatmapAccent),
                accent: heatmapAccent
            )
        }
        .prismGlassCard()
    }

    private func heatmapChip(_ accent: PrismAccent?, label: String) -> some View {
        let isOn = heatmapAccent == accent
        let color = accent?.color ?? PrismColor.text

        return Button {
            withAnimation(PrismMotion.snappy) { heatmapAccent = accent }
        } label: {
            Text(label)
                .font(.prismCaption)
                .foregroundStyle(isOn ? color : PrismColor.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background { Capsule().fill(color.opacity(isOn ? 0.16 : 0.04)) }
                .overlay {
                    Capsule().stroke(isOn ? color.opacity(0.55) : PrismColor.hairline, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Recent

    @ViewBuilder
    private var recentSection: some View {
        if !store.records.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("최근 기록")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .padding(.horizontal, 4)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Four rows by creation time, matching the web — `records` is
                // sorted by occurredAt, which diverges the moment someone
                // backdates a record.
                ForEach(store.records.sorted { $0.createdAt > $1.createdAt }.prefix(4)) { record in
                    RecordSummaryRow(record: record)
                }
            }
        } else if store.hasLoadedOnce {
            PrismPlaceholderCard(
                accent: .reading,
                title: "아직 기록이 없습니다",
                detail: "오른쪽 아래 + 버튼으로 첫 기록을 남겨 보세요."
            )
        }
    }

    // MARK: - Status

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

    private func emptyNote(_ text: String) -> some View {
        Text(text)
            .font(.prismCallout)
            .prismMuted()
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Data

    private var slices: [SpectrumRing.Slice] {
        [
            .init(accent: .reading, count: store.records(in: .reading).count),
            .init(accent: .study, count: store.records(in: .study).count),
            .init(accent: .movie, count: store.records(in: .culture).count),
        ]
    }

    private func summaryValue(for slice: SpectrumRing.Slice) -> String {
        switch slice.accent {
        case .reading: "\(slice.count)권"
        case .study:
            {
                let hours = store.records(in: .study).reduce(0) { $0 + $1.hours }
                return hours > 0 ? "\(Int(hours))h" : "\(slice.count)건"
            }()
        default: "\(slice.count)편"
        }
    }

    private var todayLabel: String {
        Date.now.formatted(.dateTime.year().month(.wide).day().weekday(.wide))
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
