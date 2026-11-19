import SwiftUI

/// Search TMDB/IGDB through the backend and start tracking a film, series, or
/// game. One sheet for all three because the fields only diverge at the end.
struct NewCultureSheet: View {
    let type: CultureType

    @Environment(PrismStore.self) private var store
    @Environment(LibraryWallModel.self) private var wall: LibraryWallModel?
    @Environment(\.dismiss) private var dismiss
    @Namespace private var covers

    @State private var query = debugAddSheetQuery
    @State private var results: [MediaSearchItem] = []
    @State private var searching = false
    @State private var searchError: Error?
    /// Bumped by "다시 시도" to run the same search again.
    @State private var attempt = 0

    @State private var selected: MediaSearchItem?
    @State private var enrichment: MediaEnrichment?
    @State private var enriching = false
    @State private var status: String
    @State private var rating = 0
    @State private var watchedEpisodes = "0"
    @State private var platform = ""
    @State private var tagInput = ""
    @State private var saving = false

    private let api = PrismAPIClient.shared

    init(type: CultureType) {
        self.type = type
        _status = State(initialValue: CultureStatus.default(for: type))
    }

    private var accent: PrismAccent {
        switch type {
        case .movie: .movie
        case .series: .series
        case .game: .game
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                TheaterSheetBackground(accent: accent)

                if let selected {
                    form(for: selected)
                } else {
                    searchList
                }
            }
            .navigationTitle(selected == nil ? "\(type.rawValue) 검색" : "기록 시작")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", systemImage: "xmark") { dismiss() }
                }
            }
        }
    }

    private var searchList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if searching {
                    CoverGridSkeleton(accent: accent)
                } else if let searchError {
                    SearchFailureLine(accent: accent, error: searchError) { attempt += 1 }
                } else if !results.isEmpty {
                    CoverGrid(tiles: results.map(tile(for:)), namespace: covers) { tile in
                        if let item = results.first(where: { $0.id == tile.id }) {
                            Task { await choose(item) }
                        }
                    }
                } else if isSearching {
                    Text("‘\(query.trimmingCharacters(in: .whitespacesAndNewlines))’에 맞는 \(type.rawValue)이 없습니다.")
                        .font(.prismCallout)
                        .prismMuted()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                        .accessibilityIdentifier("coversearch.empty")
                } else if !thisWeek.isEmpty {
                    Text("이번 주 화제작")
                        .font(.prismTitle)
                        .foregroundStyle(PrismColor.text)
                    CoverGrid(tiles: thisWeek.map(tile(for:)), namespace: covers) { tile in
                        if let item = thisWeek.first(where: { $0.id == tile.id }) {
                            Task { await choose(item) }
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "\(type.rawValue) 제목"
        )
        .task(id: SearchKey(query: query, attempt: attempt)) { await runSearch() }
    }

    private var isSearching: Bool {
        query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
    }

    /// This week's titles of this kind, for picking without typing.
    private var thisWeek: [MediaSearchItem] {
        (wall?.discoveryItems ?? []).filter { $0.cultureType == type }
    }

    private func tile(for item: MediaSearchItem) -> CoverSearchTile {
        let year = item.releaseDate.map { String($0.prefix(4)) }
        let episodes = item.episodeCount.flatMap { $0 > 0 ? "\($0)화" : nil }
        return CoverSearchTile(
            id: item.id,
            title: item.title,
            subtitle: [year, episodes].compactMap { $0 }.joined(separator: " · "),
            coverURL: item.posterURL,
            accent: accent
        )
    }

    private func runSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            results = []
            searchError = nil
            return
        }

        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }

        searching = true
        searchError = nil
        defer { searching = false }

        do {
            let apiType = switch type {
            case .movie: "movie"
            case .series: "series"
            case .game: "game"
            }
            results = try await api.searchMedia(query: trimmed, type: apiType)
        } catch is CancellationError {
            return
        } catch {
            results = []
            searchError = error
        }
    }

    private func choose(_ item: MediaSearchItem) async {
        PrismHaptics.selection()
        withAnimation(.spring(duration: 0.45, bounce: 0.12)) { selected = item }

        // Only TMDB titles have a season/episode breakdown to fetch.
        guard type != .game, let tmdbID = item.tmdbId else { return }

        enriching = true
        defer { enriching = false }
        enrichment = try? await api.enrichMedia(
            tmdbID: tmdbID,
            type: type == .series ? "series" : "movie"
        )
    }

    private func form(for item: MediaSearchItem) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                SelectedCoverHeader(
                    tile: tile(for: item),
                    detail: enriching ? "회차 정보 확인 중…" : enrichment?.episodeCount.flatMap { $0 > 0 ? "전체 \($0)화" : nil },
                    namespace: covers
                )

                VStack(alignment: .leading, spacing: 12) {
                    Text("상태")
                        .font(.prismHeadline)
                        .foregroundStyle(PrismColor.text)

                    Picker("상태", selection: $status) {
                        ForEach(CultureStatus.options(for: type), id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    // Four short choices: all of them on show, one tap each.
                    .pickerStyle(.segmented)

                    Divider().overlay(PrismColor.hairline)

                    HStack {
                        Text("별점").font(.prismCallout).prismMuted()
                        Spacer(minLength: 0)
                        StarRatingPicker(rating: $rating, accent: accent)
                    }

                    if type == .series {
                        Divider().overlay(PrismColor.hairline)
                        HStack {
                            Text("시청한 회차").font(.prismCallout).prismMuted()
                            Spacer(minLength: 0)
                            TextField("0", text: $watchedEpisodes)
                                .keyboardType(.numberPad)
                                .font(PrismFont.numeral(17, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(PrismColor.text)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 80)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .prismGlassCard()

                VStack(alignment: .leading, spacing: 12) {
                    field("플랫폼", text: $platform, placeholder: type == .game ? "예: Steam" : "예: 넷플릭스")
                    Divider().overlay(PrismColor.hairline)
                    field("태그", text: $tagInput, placeholder: "#SF #드라마")
                }
                .prismGlassCard()

                Button {
                    Task { await save(item) }
                } label: {
                    Text(saving ? "저장 중…" : "기록 시작")
                        .font(.prismHeadline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.glassProminent)
                .tint(accent.color)
                .disabled(saving)
                .accessibilityIdentifier("mediasearch.save")

                Button {
                    withAnimation(.spring(duration: 0.45, bounce: 0.12)) {
                        selected = nil
                        enrichment = nil
                    }
                } label: {
                    Text("다시 찾기")
                        .font(.prismCallout)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glass)
                .tint(PrismColor.textMuted)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.prismCaption).prismMuted()
            TextField(placeholder, text: text)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save(_ item: MediaSearchItem) async {
        saving = true
        defer { saving = false }

        await store.createCultureRecord(
            from: item,
            enrichment: enrichment,
            draft: CultureDraft(
                type: type,
                status: status,
                rating: rating,
                watchedEpisodes: Int(watchedEpisodes) ?? 0,
                platformLabel: platform.trimmingCharacters(in: .whitespacesAndNewlines),
                tags: parseTagInput(tagInput)
            )
        )

        PrismHaptics.saved()
        dismiss()
    }
}

/// What a search runs on: the text, and how many times it was retried.
struct SearchKey: Hashable {
    let query: String
    let attempt: Int
}
