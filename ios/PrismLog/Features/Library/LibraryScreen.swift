import SwiftUI

/// The library — the app's front page (spec §6.1): what's in progress,
/// the spectrum of what's been logged, the trends, and the latest records,
/// over the full library wall.
struct LibraryScreen: View {
    @Environment(PrismStore.self) private var store
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(AppNavigationModel.self) private var navigation: AppNavigationModel?
    @Environment(LibraryWallModel.self) private var wall: LibraryWallModel?

    /// The "now in progress" section has the screen: the wall hands over to
    /// its covers.
    @State private var inProgressFocused = false

    @State private var trendCumulative = true
    @State private var trendRange: TrendRange = .year
    @State private var trendEnabled: Set<PrismAccent> = [.reading, .study, .movie]
    @State private var distributionEnabled: Set<PrismAccent> = [.reading, .study, .movie]
    @State private var heatmapAccent: PrismAccent?

    var body: some View {
        PrismScreenScaffold(
            eyebrow: todayLabel,
            title: "라이브러리",
            focus: .reading,
            // Pulling past the top lowers the page onto the wall instead of
            // refreshing; the app still syncs whenever it becomes active.
            wallReveal: navigation.map { navigation in
                Binding(get: { navigation.libraryRevealed }, set: { navigation.libraryRevealed = $0 })
            }
        ) {
            PrismGlassSection {
                VStack(spacing: 14) {
                    statusBanner

                    // Spec §8: accessibility text sizes get one column.
                    if horizontalSizeClass == .regular, !dynamicTypeSize.isAccessibilitySize {
                        // Spec §6.1: on a wide screen the sections pair up in
                        // two columns that meet at the fold, if there is one.
                        FoldAwareColumns {
                            spectrumCard
                            inProgressSection
                            recentSection
                        } trailing: {
                            trendCard
                            distributionCard
                            heatmapCard
                        }
                    } else {
                        spectrumCard
                        inProgressSection
                        trendCard
                        distributionCard
                        heatmapCard
                        recentSection
                    }
                }
            }
            .navigationDestination(for: UUID.self) { id in
                RecordDetailScreen(recordID: id)
            }
        }
        .onChange(of: featureIDs, initial: true) { navigation?.libraryFeature = featureIDs }
    }

    /// The wall's big covers: the in-progress cards' covers while that
    /// section has the screen.
    private var featureIDs: [String]? {
        guard inProgressFocused else { return nil }
        let ids = LibraryMetrics.inProgress(from: store.records).map { item in
            item.record.entityID?.uuidString ?? item.record.id.uuidString
        }
        return ids.isEmpty ? nil : ids
    }

    // MARK: - In progress

    /// Spec §6.1 item 2: lens cards for what's being read, watched, played,
    /// and studied right now.
    @ViewBuilder
    private var inProgressSection: some View {
        let items = LibraryMetrics.inProgress(from: store.records)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("지금 진행 중")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .padding(.horizontal, 4)

                ScrollView(.horizontal) {
                    // Its own glass container, inside the scroll view: the
                    // screen's container draws glass in its own layer and
                    // ignores this scroll view's clip, which let lens cards
                    // show past the column and under iPhone Duo's vertical
                    // bar (Phase 7).
                    GlassEffectContainer(spacing: 12) {
                        // Gaps wider than the margin the carousel reaches
                        // into, so at rest the next card sits wholly off
                        // screen instead of peeking in cut off.
                        LazyHStack(spacing: Self.carouselMargin + 8) {
                            ForEach(items) { item in
                                NavigationLink(value: item.record.id) {
                                    LensCard(item: item)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("library.inProgress")
                                // One card per page, as wide as the column.
                                .containerRelativeFrame(.horizontal)
                                // A card on its way out fades and settles
                                // back, so the clip at the margin never
                                // cuts through a card at full strength.
                                .scrollTransition(.interactive, axis: .horizontal) { card, phase in
                                    card
                                        .opacity(1 - min(abs(phase.value), 1) * 0.7)
                                        .scaleEffect(1 - min(abs(phase.value), 1) * 0.06)
                                }
                            }
                        }
                        .scrollTargetLayout()
                    }
                }
                .scrollTargetBehavior(.viewAligned)
                .scrollIndicators(.hidden)
                // The carousel reaches into the screen margin on each side,
                // so a card is clipped at the margin, not at the column, and
                // the first card still lines up with the column at rest.
                // Clipped, not masked: glass ignores a mask but honours a
                // clip. Not `scrollClipDisabled()`: unclipped cards ran
                // under iPhone Duo's vertical bar and its `+` (spec §7.2).
                .contentMargins(.horizontal, Self.carouselMargin, for: .scrollContent)
                // The page the carousel is on, fractional mid-swipe: the
                // wall's big covers slide with it.
                .onScrollGeometryChange(for: Double.self) { geometry in
                    let card = geometry.containerSize.width - Self.carouselMargin * 2
                    let page = card + Self.carouselMargin + 8
                    guard page > 0 else { return 0 }
                    return Double((geometry.contentOffset.x + geometry.contentInsets.leading) / page)
                } action: { _, position in
                    wall?.featurePosition = position
                }
                .clipped()
                .padding(.horizontal, -Self.carouselMargin)
            }
            // The section has the screen once its top passes the upper third;
            // it lets go a little lower, so a small scroll back doesn't flicker.
            .onGeometryChange(for: CGFloat.self) { proxy in
                guard let visible = proxy.bounds(of: .scrollView(axis: .vertical)), visible.height > 0 else { return 1 }
                return -visible.minY / visible.height
            } action: { top in
                let focused = inProgressFocused ? top < 0.46 : top < 0.36
                if focused != inProgressFocused { inProgressFocused = focused }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// The screen margin (`PrismScreenScaffold`), which the carousel reaches into.
    private static let carouselMargin: CGFloat = 18

    // MARK: - Spectrum

    private var spectrumCard: some View {
        // Ring beside the counts, or above them at accessibility sizes —
        // side by side, the counts wrapped a character per line at AX5.
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 16))
            : AnyLayout(HStackLayout(spacing: 16))
        return layout {
            SpectrumRing(slices: slices, diameter: 150, lineWidth: 13)

            VStack(spacing: 0) {
                streakRow
                Divider().overlay(PrismColor.hairline)

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

    private var streakRow: some View {
        let days = LibraryMetrics.streakDays(from: store.records)
        return HStack(spacing: 10) {
            Image(systemName: "flame.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(PrismAccent.series.color)
                .frame(width: 20)
            Text("연속 기록")
                .font(.prismCallout)
                .foregroundStyle(PrismColor.text)
            Spacer(minLength: 0)
            Text("\(days)일")
                .font(PrismFont.numeral(17, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
        }
        .padding(.vertical, 9)
        .accessibilityElement(children: .combine)
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
                detail: "+ 메뉴에서 첫 기록을 남겨 보세요."
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

/// A "now in progress" card: clear glass, the cover, and only large text —
/// clear glass over the brightest covers holds large text at 3:1 but not
/// small text at 4.5:1 (issue #19), so there is no small print here.
struct LensCard: View {
    let item: LibraryMetrics.InProgress

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            CoverImage(url: item.record.coverURL, accent: item.accent, title: item.title, cornerRadius: 10)
                .frame(width: 64, height: 96)
                .shadow(color: .black.opacity(0.25), radius: 10, y: 6)

            VStack(alignment: .leading, spacing: 8) {
                Text(item.title)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 4 : 2)

                Spacer(minLength: 0)

                Text(item.detail)
                    .font(PrismFont.numeral(19, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                if let progress = item.progress {
                    ProgressView(value: Double(progress), total: 100)
                        .tint(item.accent.color)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // Height grows with the text; at accessibility sizes a fixed 96pt cut
        // the title to its first word.
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 96)
        .prismLensCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.title), \(item.accent.label), \(item.detail)")
    }
}

#Preview {
    LibraryScreen()
        .environment(PrismStore.preview())
        .environment(AppNavigationModel())
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
