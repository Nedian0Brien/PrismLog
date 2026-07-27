import SwiftUI

/// Search TMDB/IGDB through the backend and start tracking a film, series, or
/// game. One sheet for all three because the fields only diverge at the end.
struct NewCultureSheet: View {
    let type: CultureType

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [MediaSearchItem] = []
    @State private var searching = false
    @State private var searchError: String?

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
                SpectrumBloomBackground(focus: accent)

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
                    Button("취소") { dismiss() }
                }
            }
        }
    }

    private var searchList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if searching {
                    ProgressView().padding(.top, 40)
                } else if let searchError {
                    PrismPlaceholderCard(accent: .movie, title: "검색에 실패했습니다", detail: searchError)
                } else if results.isEmpty {
                    PrismPlaceholderCard(
                        accent: accent,
                        title: query.isEmpty ? "무엇을 기록할까요?" : "결과가 없습니다",
                        detail: query.isEmpty
                            ? "제목을 입력하면 포스터와 회차 정보까지 함께 가져옵니다."
                            : "제목의 일부로 다시 검색해 보세요."
                    )
                }

                ForEach(results) { item in
                    Button {
                        Task { await choose(item) }
                    } label: {
                        row(item)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("mediasearch.result")
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "제목"
        )
        .task(id: query) { await runSearch() }
    }

    private func row(_ item: MediaSearchItem) -> some View {
        HStack(spacing: 12) {
            CoverImage(url: item.posterURL, accent: accent)
                .frame(width: 48, height: 70)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let release = item.releaseDate, !release.isEmpty {
                    Text(release)
                        .font(.prismMicro)
                        .prismMuted()
                }

                if let episodes = item.episodeCount, episodes > 0 {
                    Text("\(episodes)화")
                        .font(.prismMicro)
                        .foregroundStyle(accent.color)
                }
            }

            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: accent.color, padding: 12)
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
            searchError = error.localizedDescription
        }
    }

    private func choose(_ item: MediaSearchItem) async {
        PrismHaptics.selection()
        selected = item

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
                HStack(alignment: .top, spacing: 14) {
                    CoverImage(url: item.posterURL, accent: accent)
                        .frame(width: 92, height: 134)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.title)
                            .font(.prismTitle)
                            .foregroundStyle(PrismColor.text)
                            .fixedSize(horizontal: false, vertical: true)

                        if let release = item.releaseDate {
                            Text(release).font(.prismCaption).prismMuted()
                        }
                        if enriching {
                            Text("회차 정보 확인 중…")
                                .font(.prismMicro)
                                .foregroundStyle(accent.color)
                        } else if let total = enrichment?.episodeCount, total > 0 {
                            Text("전체 \(total)화")
                                .font(.prismMicro)
                                .foregroundStyle(accent.color)
                        }
                    }

                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("상태")
                        .font(.prismHeadline)
                        .foregroundStyle(PrismColor.text)

                    Picker("상태", selection: $status) {
                        ForEach(CultureStatus.options(for: type), id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(accent.color)

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
                    selected = nil
                    enrichment = nil
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
