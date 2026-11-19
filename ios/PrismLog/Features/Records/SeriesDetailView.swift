import SwiftUI

/// A series' detail, laid out as the web's `SeriesDetailPage`
/// (`src/features/prismlog/pages/recordsPage.jsx:1063`, user decision
/// 2026-11-19: "레이아웃은 웹 버전 쪽에 패리티를 맞추자"): one hero card —
/// poster, title and badges, synopsis, the next episode, watching status,
/// season bars, the total donut and its trend — then a board of seasons,
/// each a row of large episode cards you swipe through.
struct SeriesDetailContent: View {
    let record: RecordItem
    let progress: SeriesProgress
    var onEdit: () -> Void
    /// Brings a season's board to the middle of the page; the page owns the
    /// vertical scroll.
    var onRevealSeason: (Int) -> Void
    var onProgressSaved: (SeriesProgressChange) -> Void

    @Environment(PrismStore.self) private var store
    /// The width the page gives the detail, which on a split screen is far
    /// narrower than the window.
    @State private var width: CGFloat = 0

    @State private var pendingUnwatch: SeriesEpisode?
    @State private var savingKey: String?
    @State private var completedKey: String?
    @State private var highlightedKey: String?
    /// Each season row's horizontal position, by the episode it rests on.
    @State private var positions: [Int: String] = [:]

    /// The web lays the hero out in three columns only where there is room
    /// for them; a phone, or the detail pane of a split view, stacks them.
    private var isPhone: Bool { width < 720 }
    private var accent: Color { PrismAccent.series.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            heroCard
            seasonBoard
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onAppear(perform: restPositions)
        .sheet(item: $pendingUnwatch) { episode in
            SeriesUnwatchSheet(
                episode: episode,
                affected: affectedEpisodes(unwatching: episode),
                onConfirm: {
                    pendingUnwatch = nil
                    commit(episode)
                },
                onCancel: { pendingUnwatch = nil }
            )
            .presentationDetents([.height(372)])
            .presentationBackground(.thinMaterial)
        }
    }

    // MARK: - Hero card

    private var heroCard: some View {
        Group {
            if isPhone {
                VStack(alignment: .leading, spacing: 18) {
                    poster.aspectRatio(2.0 / 3.0, contentMode: .fit).frame(maxWidth: .infinity)
                    infoColumn
                    totalColumn
                }
            } else {
                HStack(alignment: .top, spacing: 18) {
                    poster.frame(width: 180, height: 270)
                    infoColumn.frame(maxWidth: .infinity, alignment: .leading)
                    totalColumn.frame(width: 158)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: accent, padding: isPhone ? 16 : 22)
    }

    private var poster: some View {
        CoverImage(url: record.coverURL, accent: .series, title: record.title, cornerRadius: 22)
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(accent.opacity(0.15))
            }
            .shadow(color: .black.opacity(0.22), radius: 20, y: 20)
    }

    private var infoColumn: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Series Detail")
                        .font(PrismFont.text(12, .semiBold))
                        .tracking(1.2)
                        .textCase(.uppercase)
                        .foregroundStyle(accent)

                    Text(record.title)
                        .font(PrismFont.text(isPhone ? 24 : 30, .extraBold, relativeTo: .title))
                        .foregroundStyle(PrismColor.text)
                        .fixedSize(horizontal: false, vertical: true)

                    badges
                }

                Spacer(minLength: 0)

                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .accessibilityLabel("편집")
            }

            if let overview = record.overview, !overview.isEmpty {
                Text(overview)
                    .font(PrismFont.text(13))
                    .lineSpacing(5)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            }

            nextEpisodeCard
            watchingStatusCard
            seasonBarsCard
        }
    }

    private var badges: some View {
        FlowLayout(spacing: 8) {
            if let status = record.status, !status.isEmpty {
                SeriesStatusBadge(status: status)
            }
            if let platform = SeriesPlatform(record: record) {
                SeriesPlatformBadge(platform: platform)
            }
            if let release = record.releaseDate.flatMap(SeriesDates.monthDay) {
                tagChip(release)
            }
            ForEach(record.tags, id: \.self) { tag in
                tagChip("#\(tag)")
            }
        }
    }

    private func tagChip(_ text: String) -> some View {
        Text(text)
            .font(PrismFont.text(11, .semiBold))
            .foregroundStyle(accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background { Capsule().fill(accent.opacity(0.13)) }
            .overlay { Capsule().strokeBorder(accent.opacity(0.2)) }
    }

    /// The episode you'd watch next: its still, its name and its synopsis.
    /// Tapping it brings that episode's card into view on the board below.
    private var nextEpisodeCard: some View {
        let next = progress.nextEpisode
        let finished = next == nil && progress.totalEpisodes > 0

        return Button {
            if let next { reveal(next) }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                EpisodeStill(url: next?.stillURL, label: nil)
                    .frame(width: isPhone ? 84 : 104, height: isPhone ? 60 : 74)
                    .clipShape(.rect(cornerRadius: 14, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(accent.opacity(0.13))
                    }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Next episode")
                        .font(PrismFont.text(11, .semiBold))
                        .tracking(1)
                        .textCase(.uppercase)
                        .foregroundStyle(accent)

                    Text(next.map { "시즌 \($0.seasonNumber) · \($0.name ?? "에피소드 \($0.episodeNumber)")" }
                         ?? (finished ? "완주" : "다음 회차 정보 없음"))
                        .font(PrismFont.text(15, .extraBold))
                        .foregroundStyle(PrismColor.text)
                        .multilineTextAlignment(.leading)

                    if let overview = next?.overview, !overview.isEmpty {
                        Text(overview)
                            .font(PrismFont.text(12))
                            .lineSpacing(3)
                            .prismMuted()
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.13)) }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(next == nil)
        .accessibilityIdentifier("series.nextEpisode")
    }

    private var watchingStatusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Watching status")
                        .font(PrismFont.text(11))
                        .prismMuted()
                    Text(progress.totalEpisodes > 0 || progress.watchedEpisodes > 0 ? progress.playtimeLabel : "회차 미기록")
                        .font(PrismFont.numeral(15, weight: .bold))
                        .foregroundStyle(PrismColor.text)
                }
                Spacer(minLength: 0)
                if record.rating > 0 {
                    RatingStars(rating: record.rating, accent: .series, size: 14)
                }
            }
            ProgressMeter(value: Double(progress.progress) / 100, accent: .series, height: 8)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            LinearGradient(colors: [accent.opacity(0.08), Color.white.opacity(0.03)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: .rect(cornerRadius: 18, style: .continuous)
        )
        .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.14)) }
    }

    @ViewBuilder
    private var seasonBarsCard: some View {
        if !progress.seasons.isEmpty {
            VStack(spacing: 10) {
                ForEach(progress.seasons) { season in
                    HStack(spacing: 8) {
                        Text(season.name ?? "S\(season.seasonNumber)")
                            .font(PrismFont.text(11))
                            .prismMuted()
                            .lineLimit(2)
                            .frame(width: 64, alignment: .leading)
                        ProgressMeter(value: Double(season.percent) / 100, accent: .series, height: 6)
                        Text("\(season.percent)%")
                            .font(PrismFont.numeral(12, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(accent)
                            .frame(width: 48, alignment: .trailing)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.13)) }
        }
    }

    /// The whole series: the donut, the counts under it, and the trend.
    private var totalColumn: some View {
        VStack(spacing: 8) {
            let diameter: CGFloat = isPhone ? 126 : 144
            ZStack {
                Circle().stroke(Color.white.opacity(0.08), lineWidth: 12)
                Circle()
                    .trim(from: 0, to: CGFloat(progress.progress) / 100)
                    .stroke(accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 2) {
                    Text("TOTAL")
                        .font(PrismFont.text(13))
                        .tracking(0.5)
                        .prismMuted()
                    Text("\(progress.progress)%")
                        .font(PrismFont.numeral(isPhone ? 28 : 34, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(accent)
                }
            }
            .frame(width: diameter, height: diameter)
            .animation(PrismMotion.meter, value: progress.progress)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("전체 진행률 \(progress.progress)퍼센트")

            Text(progress.totalEpisodes > 0 || progress.watchedEpisodes > 0 ? progress.playtimeLabel : "회차 미기록")
                .font(PrismFont.text(12))
                .prismMuted()

            Text(seasonLine)
                .font(PrismFont.text(12))
                .prismMuted()

            SeriesTrendCard(progress: progress)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, isPhone ? 16 : 0)
        .padding(.bottom, 4)
    }

    private var seasonLine: String {
        let count = record.payload.int("season_count") ?? progress.seasons.count
        let seasons = count > 0 ? "\(count)시즌" : "시즌 정보 없음"
        guard let runtime = record.payload.int("runtime"), runtime > 0 else { return seasons }
        return "\(seasons) · 평균 \(runtime)분"
    }

    // MARK: - Season board

    private var seasonBoard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Season Board")
                    .font(PrismFont.text(12, .semiBold))
                    .tracking(1.2)
                    .textCase(.uppercase)
                    .foregroundStyle(accent)
                Text("시즌별 진행 현황")
                    .font(PrismFont.text(22, .extraBold, relativeTo: .title2))
                    .foregroundStyle(PrismColor.text)
            }
            .padding(.top, 8)

            if progress.seasons.isEmpty {
                Text("시즌 상세 정보가 아직 없습니다. 새로 추가한 시리즈이거나 TMDB 보강이 완료되면 회차별 목록이 표시됩니다.")
                    .font(PrismFont.text(13))
                    .prismMuted()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .prismGlassCard(padding: 18)
            } else {
                ForEach(progress.seasons) { season in
                    seasonCard(season)
                        .id("series.season.\(season.seasonNumber)")
                }
            }
        }
    }

    private func seasonCard(_ season: SeriesSeason) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(season.name ?? "시즌 \(season.seasonNumber)")
                        .font(PrismFont.text(17, .extraBold))
                        .foregroundStyle(PrismColor.text)
                    Text(seasonMeta(season))
                        .font(PrismFont.text(12))
                        .prismMuted()
                }
                Spacer(minLength: 0)
                Text("\(season.percent)%")
                    .font(PrismFont.numeral(14, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(accent)
            }

            ProgressMeter(value: Double(season.percent) / 100, accent: .series, height: 7)

            if season.episodes.isEmpty {
                Text("회차 상세 정보가 없습니다.")
                    .font(PrismFont.text(12))
                    .prismMuted()
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .frame(minWidth: 220, alignment: .leading)
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(accent.opacity(0.21), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
            } else {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 12) {
                        ForEach(season.episodes) { episode in
                            episodeCard(episode)
                                .id(episode.key)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollIndicators(.hidden)
                .scrollTargetBehavior(.viewAligned)
                .scrollPosition(id: position(for: season.seasonNumber), anchor: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: accent, padding: 18)
    }

    private func seasonMeta(_ season: SeriesSeason) -> String {
        let parts = [
            season.airDate.flatMap(SeriesDates.monthDay),
            season.episodes.isEmpty ? nil : "시즌 총 \(season.episodes.count)화",
            season.watchedCount > 0 ? "\(season.watchedCount)화 시청함" : nil,
        ].compactMap { $0 }
        return parts.isEmpty ? "메타데이터 없음" : parts.joined(separator: " · ")
    }

    private func episodeCard(_ episode: SeriesEpisode) -> some View {
        let isCurrent = progress.nextEpisode?.key == episode.key
        let isSaving = savingKey == episode.key

        return SeriesEpisodeCard(
            episode: episode,
            isCurrent: isCurrent,
            isSaving: isSaving,
            justCompleted: completedKey == episode.key,
            highlighted: highlightedKey == episode.key,
            width: isPhone ? 244 : 276,
            minHeight: isPhone ? 350 : 366,
            onToggle: { select(episode) }
        )
        .onTapGesture {
            // The card marks an episode watched; undoing goes through its
            // check button, with a confirmation, as on the web.
            if !episode.watched { select(episode) }
        }
        .disabled(savingKey != nil)
        .id(isCurrent ? "series.currentEpisode" : episode.key)
    }

    // MARK: - Actions

    private func position(for season: Int) -> Binding<String?> {
        Binding(
            get: { positions[season] },
            set: { positions[season] = $0 }
        )
    }

    /// Each season row starts at the episode that matters in it: the next
    /// one to watch, or the last one watched, or the first.
    private func restPositions() {
        for season in progress.seasons where positions[season.seasonNumber] == nil {
            let resting = season.episodes.first { $0.key == progress.nextEpisode?.key }
                ?? season.episodes.last(where: \.watched)
            if let resting { positions[season.seasonNumber] = resting.key }
        }
    }

    private func reveal(_ episode: SeriesEpisode) {
        onRevealSeason(episode.seasonNumber)
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            withAnimation(PrismMotion.screen) { positions[episode.seasonNumber] = episode.key }
            try? await Task.sleep(for: .milliseconds(400))
            withAnimation(.easeOut(duration: 0.3)) { highlightedKey = episode.key }
            try? await Task.sleep(for: .milliseconds(1900))
            withAnimation(.easeOut(duration: 0.5)) {
                if highlightedKey == episode.key { highlightedKey = nil }
            }
        }
    }

    private func select(_ episode: SeriesEpisode) {
        if episode.watched {
            pendingUnwatch = episode
        } else {
            commit(episode)
        }
    }

    /// Everything that loses its check when `episode` is unwatched: it and
    /// every watched episode after it.
    private func affectedEpisodes(unwatching episode: SeriesEpisode) -> [SeriesEpisode] {
        progress.seasons.flatMap(\.episodes).filter {
            $0.absoluteNumber >= episode.absoluteNumber && $0.absoluteNumber <= progress.watchedEpisodes
        }
    }

    private func commit(_ episode: SeriesEpisode) {
        guard savingKey == nil else { return }
        savingKey = episode.key
        if !episode.watched { completedKey = episode.key }
        PrismHaptics.impact(episode.watched ? .light : .medium)

        Task {
            let before = progress.progress
            await store.setSeriesProgress(id: record.id, upTo: episode)
            savingKey = nil

            if let updated = store.record(id: record.id), let after = updated.seriesProgress {
                let season = after.seasons.first { $0.seasonNumber == episode.seasonNumber }
                onProgressSaved(SeriesProgressChange(
                    title: updated.title,
                    posterURL: updated.coverURL,
                    previousProgress: before,
                    nextProgress: after.progress,
                    seasons: season.map { [(name: $0.name ?? "시즌 \($0.seasonNumber)", progress: $0.percent)] } ?? []
                ))
            }
            try? await Task.sleep(for: .milliseconds(620))
            if completedKey == episode.key { completedKey = nil }
        }
    }
}

// MARK: - Episode card

/// One episode on the season board: the still, its number and name, a check
/// to mark it, when it aired and how long it runs, the synopsis, and where
/// it stands (`recordsPage.jsx:1703`).
struct SeriesEpisodeCard: View {
    let episode: SeriesEpisode
    let isCurrent: Bool
    let isSaving: Bool
    let justCompleted: Bool
    let highlighted: Bool
    let width: CGFloat
    let minHeight: CGFloat
    let onToggle: () -> Void

    private var accent: Color { PrismAccent.series.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            EpisodeStill(url: episode.stillURL, label: "No Still", watched: episode.watched)
                .frame(height: 144)
                .frame(maxWidth: .infinity)
                .clipShape(.rect(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(episode.watched ? SeriesDetailColors.success.opacity(0.3) : PrismColor.hairline)
                }

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("EP \(episode.episodeNumber)")
                            .font(PrismFont.text(11, .medium))
                            .foregroundStyle(episode.watched ? accent : PrismColor.textMuted)
                        Text(episode.name?.isEmpty == false ? episode.name! : "제 \(episode.episodeNumber)화")
                            .font(PrismFont.text(13, .semiBold))
                            .foregroundStyle(PrismColor.text)
                            .lineSpacing(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    checkButton
                }

                Text(meta)
                    .font(PrismFont.text(11))
                    .prismMuted()

                if let overview = episode.overview, !overview.isEmpty {
                    Text(overview)
                        .font(PrismFont.text(12))
                        .lineSpacing(3)
                        .prismMuted()
                        .lineLimit(3)
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 10) {
                Text(stateLabel)
                    .font(PrismFont.text(11, .bold))
                    .foregroundStyle(stateColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background { Capsule().fill(stateFill) }
                Spacer(minLength: 0)
                if let watchedAt = episode.watchedAt {
                    Text("\(SeriesDates.monthDay(watchedAt)) 시청")
                        .font(PrismFont.text(11))
                        .prismMuted()
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(width: width, alignment: .topLeading)
        .frame(minHeight: minHeight, alignment: .topLeading)
        .background(background, in: .rect(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(border)
        }
        .shadow(color: highlighted ? accent.opacity(0.25) : .clear, radius: 14)
        .scaleEffect(justCompleted ? 1.02 : 1)
        .animation(.spring(duration: 0.56, bounce: 0.35), value: justCompleted)
        .opacity(isSaving ? 0.72 : 1)
        .contentShape(.rect(cornerRadius: 16))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("EP \(episode.episodeNumber) \(episode.name ?? ""), \(stateLabel)")
        .accessibilityIdentifier("series.episode")
    }

    private var checkButton: some View {
        Button(action: onToggle) {
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(episode.watched ? SeriesDetailColors.onSuccess : PrismColor.textMuted)
                .frame(width: 28, height: 28)
                .background {
                    Circle().fill(
                        isSaving ? Color.white.opacity(0.14)
                            : episode.watched ? SeriesDetailColors.success
                            : PrismColor.background.opacity(0.52)
                    )
                }
                .overlay {
                    if !episode.watched && !isSaving {
                        Circle().strokeBorder(PrismColor.text.opacity(0.47), lineWidth: 1.5)
                    }
                }
                .shadow(color: episode.watched ? SeriesDetailColors.success.opacity(0.15) : .clear, radius: 9, y: 8)
                .scaleEffect(justCompleted ? 1.15 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(episode.watched ? "시청 완료 해제" : "시청 완료로 표시")
    }

    private var meta: String {
        let parts = [
            episode.airDate.flatMap(SeriesDates.monthDay),
            episode.runtime.map { "\($0)분" },
        ].compactMap { $0 }
        return parts.isEmpty ? "방영 정보 없음" : parts.joined(separator: " · ")
    }

    private var stateLabel: String {
        if isSaving { return "저장 중" }
        if episode.watched { return "시청 완료" }
        return isCurrent ? "다음 회차" : "미시청"
    }

    private var stateColor: Color {
        episode.watched ? SeriesDetailColors.success : isCurrent ? accent : PrismColor.textMuted
    }

    private var stateFill: Color {
        episode.watched ? SeriesDetailColors.success.opacity(0.1)
            : isCurrent ? accent.opacity(0.1) : Color.white.opacity(0.04)
    }

    private var background: Color {
        episode.watched ? accent.opacity(0.08) : isCurrent ? Color.white.opacity(0.06) : Color.white.opacity(0.03)
    }

    private var border: Color {
        if highlighted { return accent.opacity(0.5) }
        if isCurrent { return accent.opacity(0.4) }
        return episode.watched ? accent.opacity(0.21) : PrismColor.hairline
    }
}

/// A TMDB still, or a quiet placeholder when there is none.
struct EpisodeStill: View {
    let url: URL?
    /// Shown on the placeholder; the small next-episode still shows an icon.
    let label: String?
    var watched = false

    var body: some View {
        // The frame comes from outside; the still fills it and never sizes it.
        LinearGradient(
            colors: [PrismAccent.series.color.opacity(0.13), Color.white.opacity(0.04)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay {
            if let url {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    }
                }
            } else if let label {
                Text(label)
                    .font(PrismFont.text(11, .bold))
                    .foregroundStyle(watched ? SeriesDetailColors.success : PrismAccent.series.color)
            } else {
                Image(systemName: "film")
                    .font(.system(size: 18))
                    .foregroundStyle(PrismAccent.series.color)
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

// MARK: - Unwatch confirmation

/// The web's "시청 완료를 해제할까요?" modal: what unwatching takes back
/// with it, before it happens.
struct SeriesUnwatchSheet: View {
    let episode: SeriesEpisode
    let affected: [SeriesEpisode]
    let onConfirm: () -> Void
    let onCancel: () -> Void

    private var accent: Color { PrismAccent.series.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Undo Completion")
                    .font(PrismFont.text(11, .semiBold))
                    .tracking(1)
                    .textCase(.uppercase)
                    .foregroundStyle(accent)
                Text("시청 완료를 해제할까요?")
                    .font(PrismFont.text(20, .extraBold))
                    .foregroundStyle(PrismColor.text)
                Text("시즌 \(episode.seasonNumber) · EP \(episode.episodeNumber) 완료를 해제하면 이 회차 이후 완료 표시도 함께 해제됩니다.")
                    .font(PrismFont.text(13))
                    .lineSpacing(4)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 14) {
                ZStack(alignment: .topLeading) {
                    let preview = Array(affected.prefix(3))
                    ForEach(Array(preview.enumerated()), id: \.element.key) { index, item in
                        EpisodeStill(url: item.stillURL, label: nil)
                            .frame(width: 54, height: 78)
                            .clipShape(.rect(cornerRadius: 12, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(accent.opacity(0.15))
                            }
                            .shadow(color: .black.opacity(0.22), radius: 12, y: 10)
                            .offset(x: CGFloat(index) * 18, y: CGFloat(index) * 4)
                            .zIndex(Double(preview.count - index) + (item.key == episode.key ? 10 : 0))
                    }
                }
                .frame(width: 96, height: 86, alignment: .topLeading)

                VStack(alignment: .leading, spacing: 6) {
                    Text(episode.name ?? "EP \(episode.episodeNumber)")
                        .font(PrismFont.text(14, .bold))
                        .foregroundStyle(PrismColor.text)
                    Text("총 \(affected.count)개 회차가 해제됩니다.")
                        .font(PrismFont.text(12))
                        .prismMuted()
                    Text(affectedList)
                        .font(PrismFont.text(11))
                        .prismMuted()
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.13)) }

            HStack(spacing: 10) {
                Spacer(minLength: 0)
                Button("취소", action: onCancel)
                    .buttonStyle(.glass)
                    .tint(PrismColor.text)
                    .controlSize(.large)
                Button("완료 해제", action: onConfirm)
                    .buttonStyle(.glassProminent)
                    .tint(accent)
                    .controlSize(.large)
                    .accessibilityIdentifier("series.unwatch.confirm")
            }
            .font(PrismFont.text(13, .bold))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 22)
    }

    private var affectedList: String {
        let shown = affected.prefix(3).map { "EP \($0.episodeNumber)" }.joined(separator: " · ")
        return affected.count > 3 ? "\(shown) · +\(affected.count - 3)" : shown
    }
}

// MARK: - Badges

/// The web's `StatusBadge` colours (`ui.jsx:432`).
struct SeriesStatusBadge: View {
    let status: String

    var body: some View {
        let color: Color = switch status {
        case "시청 중", "플레이 중": PrismAccent.reading.color
        case "시청 완료", "플레이 완료": PrismAccent.study.color
        case "기대 중": PrismAccent.movie.color
        default: Color(hex: 0xA09890)
        }
        Text(status)
            .font(PrismFont.text(11, .semiBold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 3)
            .background { Capsule().fill(color.opacity(0.13)) }
            .overlay { Capsule().strokeBorder(color.opacity(0.2)) }
    }
}

// MARK: - Shared

enum SeriesDetailColors {
    /// The web's `successColor` (`recordsPage.jsx:1081`).
    static let success = Color(hex: 0x63D2A4)
    static let onSuccess = Color(hex: 0x182017)
}

/// "7월 17일", the web's `formatMonthDayLabel`.
enum SeriesDates {
    static func monthDay(_ date: Date) -> String {
        let calendar = Calendar(identifier: .gregorian)
        let parts = calendar.dateComponents([.month, .day], from: date)
        return "\(parts.month ?? 0)월 \(parts.day ?? 0)일"
    }

    static func monthDay(_ string: String) -> String? {
        let day = String(string.prefix(10))
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: day) { return monthDay(date) }
        return PrismDateCoding.parse(string).map(monthDay)
    }
}

extension SeriesSeason {
    /// Share of this season watched, in whole percent.
    var percent: Int {
        episodes.isEmpty ? 0 : Int((Double(watchedCount) / Double(episodes.count) * 100).rounded())
    }
}
