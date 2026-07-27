import SwiftUI

// MARK: - Series

/// Season-by-season episode list. Tapping an episode moves the watched pointer
/// to it — which also marks everything before it — because that is how the web
/// stores progress (`watched_episode_count`, a count rather than a set).
struct SeriesProgressSection: View {
    let record: RecordItem
    let progress: SeriesProgress

    @Environment(PrismStore.self) private var store
    @State private var expandedSeasons: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header

            ForEach(progress.seasons) { season in
                seasonBlock(season)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.series.color)
        .onAppear {
            // Open the season the user is currently in.
            if let next = progress.nextEpisode {
                expandedSeasons.insert(next.seasonNumber)
            } else if let first = progress.seasons.first {
                expandedSeasons.insert(first.seasonNumber)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 16) {
            ProgressDonut(value: Double(progress.progress) / 100, accent: .series)

            VStack(alignment: .leading, spacing: 4) {
                Text(progress.playtimeLabel)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                if let next = progress.nextEpisode {
                    Text("다음 S\(next.seasonNumber)E\(next.episodeNumber)")
                        .font(.prismCaption)
                        .foregroundStyle(PrismAccent.series.color)
                } else if progress.totalEpisodes > 0 {
                    Text("시청 완료")
                        .font(.prismCaption)
                        .foregroundStyle(PrismAccent.series.color)
                }
            }

            Spacer(minLength: 0)
        }
    }

    private func seasonBlock(_ season: SeriesSeason) -> some View {
        let isOpen = expandedSeasons.contains(season.seasonNumber)

        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(PrismMotion.snappy) {
                    if isOpen {
                        expandedSeasons.remove(season.seasonNumber)
                    } else {
                        expandedSeasons.insert(season.seasonNumber)
                    }
                }
            } label: {
                HStack {
                    Text(season.name ?? "시즌 \(season.seasonNumber)")
                        .font(.prismCallout)
                        .foregroundStyle(PrismColor.text)

                    Spacer(minLength: 0)

                    Text("\(season.watchedCount)/\(season.episodes.count)")
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()

                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .bold))
                        .prismMuted()
                        .rotationEffect(.degrees(isOpen ? 0 : -90))
                }
            }
            .buttonStyle(.plain)

            if isOpen {
                ForEach(season.episodes) { episode in
                    episodeRow(episode)
                }
            }
        }
    }

    private func episodeRow(_ episode: SeriesEpisode) -> some View {
        Button {
            Task {
                PrismHaptics.impact(episode.watched ? .light : .medium)
                await store.setSeriesProgress(id: record.id, upTo: episode)
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: episode.watched ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(episode.watched
                                     ? PrismAccent.series.color
                                     : PrismColor.textMuted.opacity(0.5))

                Text("E\(episode.episodeNumber)")
                    .font(PrismFont.numeral(13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(episode.watched ? PrismColor.text : PrismColor.textMuted)
                    .frame(width: 32, alignment: .leading)

                Text(episode.name ?? "회차 정보 없음")
                    .font(.prismCaption)
                    .foregroundStyle(episode.watched ? PrismColor.text : PrismColor.textMuted)
                    .lineLimit(1)

                Spacer(minLength: 0)

                if let watchedAt = episode.watchedAt {
                    Text(watchedAt, format: .dateTime.month().day())
                        .font(.prismMicro)
                        .prismMuted()
                }
            }
            .padding(.vertical, 3)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("시즌 \(episode.seasonNumber) \(episode.episodeNumber)화")
        .accessibilityValue(episode.watched ? "시청함" : "미시청")
    }
}

struct ProgressDonut: View {
    let value: Double
    var accent: PrismAccent = .series
    var diameter: CGFloat = 74

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.08), lineWidth: 8)

            Circle()
                .trim(from: 0, to: max(0, min(value, 1)))
                .stroke(accent.color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: accent.color.opacity(0.5), radius: 5)

            Text("\(Int((value * 100).rounded()))%")
                .font(PrismFont.numeral(16, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
        }
        .frame(width: diameter, height: diameter)
        .animation(PrismMotion.meter, value: value)
        .accessibilityHidden(true)
    }
}

// MARK: - Game

struct GameSessionsSection: View {
    let record: RecordItem

    @State private var addingSession = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("플레이 기록")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                Button {
                    addingSession = true
                } label: {
                    Label("추가", systemImage: "plus")
                        .font(.prismCaption)
                }
                .tint(PrismAccent.game.color)
                .accessibilityIdentifier("game.addSession")
            }

            if record.totalGameMinutes > 0 {
                HStack {
                    Text("누적")
                        .font(.prismCaption)
                        .prismMuted()
                    Spacer(minLength: 0)
                    Text("\(record.totalGameMinutes / 60)시간 \(String(format: "%02d", record.totalGameMinutes % 60))분")
                        .font(PrismFont.numeral(16, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.game.color)
                }
            }

            if record.gameSessions.isEmpty {
                Text("아직 플레이 기록이 없습니다.")
                    .font(.prismCaption)
                    .prismMuted()
            } else {
                ForEach(record.gameSessions) { session in
                    HStack(spacing: 10) {
                        Circle()
                            .fill(PrismAccent.game.color)
                            .frame(width: 7, height: 7)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.durationLabel)
                                .font(.prismCallout)
                                .foregroundStyle(PrismColor.text)

                            if !session.note.isEmpty {
                                Text(session.note)
                                    .font(.prismMicro)
                                    .prismMuted()
                                    .lineLimit(2)
                            }
                        }

                        Spacer(minLength: 0)

                        if let playedAt = session.playedAt {
                            Text(playedAt, format: .dateTime.month().day())
                                .font(.prismMicro)
                                .prismMuted()
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.game.color)
        .sheet(isPresented: $addingSession) {
            GameSessionSheet(record: record)
        }
    }
}

struct GameSessionSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var playedAt = Date.now
    @State private var hours = "1"
    @State private var minutes = "0"
    @State private var note = ""
    @State private var saving = false

    private var totalMinutes: Int {
        (Int(hours) ?? 0) * 60 + (Int(minutes) ?? 0)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .game)

                ScrollView {
                    VStack(spacing: 16) {
                        VStack(spacing: 10) {
                            DatePicker("플레이 날짜", selection: $playedAt, displayedComponents: [.date, .hourAndMinute])
                                .font(.prismCallout)

                            Divider().overlay(PrismColor.hairline)

                            HStack {
                                Text("플레이 시간").font(.prismCallout).prismMuted()
                                Spacer(minLength: 0)
                                TextField("0", text: $hours)
                                    .keyboardType(.numberPad)
                                    .frame(width: 44)
                                    .multilineTextAlignment(.trailing)
                                Text("시간").font(.prismCaption).prismMuted()
                                TextField("0", text: $minutes)
                                    .keyboardType(.numberPad)
                                    .frame(width: 44)
                                    .multilineTextAlignment(.trailing)
                                Text("분").font(.prismCaption).prismMuted()
                            }
                            .font(PrismFont.numeral(17, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(PrismColor.text)
                        }
                        .tint(PrismAccent.game.color)
                        .prismGlassCard()

                        VStack(alignment: .leading, spacing: 8) {
                            Text("메모").font(.prismHeadline).foregroundStyle(PrismColor.text)
                            TextField("무엇을 했나요?", text: $note, axis: .vertical)
                                .lineLimit(3...6)
                                .font(.prismBody)
                                .foregroundStyle(PrismColor.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .prismGlassCard()
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("플레이 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        Task {
                            saving = true
                            await store.addGameSession(
                                id: record.id,
                                playedAt: playedAt,
                                durationMinutes: totalMinutes,
                                note: note
                            )
                            PrismHaptics.saved()
                            dismiss()
                        }
                    }
                    .disabled(totalMinutes <= 0 || saving)
                }
            }
        }
    }
}

// MARK: - Study

/// Table of contents as a checklist. The web supports arbitrary nesting and
/// drag reordering; this renders the tree and toggles nodes, which is what
/// progress is actually computed from.
struct StudyTableOfContents: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store

    private struct Node: Identifiable {
        let id: String
        let title: String
        let completed: Bool
        let depth: Int
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("목차")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                let done = nodes.filter(\.completed).count
                Text("\(done)/\(nodes.count)")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }

            if nodes.isEmpty {
                Text("목차가 없습니다. 웹에서 추가하거나 새 기록을 만들 때 입력할 수 있습니다.")
                    .font(.prismCaption)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(nodes) { node in
                    Button {
                        Task {
                            PrismHaptics.impact(node.completed ? .light : .medium)
                            await store.setStudyNodeCompleted(
                                id: record.id,
                                nodeID: node.id,
                                completed: !node.completed
                            )
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: node.completed ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 17))
                                .foregroundStyle(node.completed
                                                 ? PrismAccent.study.color
                                                 : PrismColor.textMuted.opacity(0.5))

                            Text(node.title)
                                .font(.prismCallout)
                                .foregroundStyle(node.completed ? PrismColor.textMuted : PrismColor.text)
                                .strikethrough(node.completed, color: PrismColor.textMuted)
                                .multilineTextAlignment(.leading)

                            Spacer(minLength: 0)
                        }
                        .padding(.leading, CGFloat(node.depth) * 16)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private var nodes: [Node] {
        flatten(record.payload.array("toc") ?? [], depth: 0)
    }

    private func flatten(_ raw: [JSONValue], depth: Int) -> [Node] {
        raw.enumerated().flatMap { index, entry -> [Node] in
            guard let fields = entry.objectValue else { return [] }
            let node = Node(
                id: fields.string("id") ?? "node-\(depth)-\(index)",
                title: fields.string("title") ?? "제목 없음",
                completed: fields.bool("completed") ?? false,
                depth: depth
            )
            return [node] + flatten(fields["children"]?.arrayValue ?? [], depth: depth + 1)
        }
    }
}
