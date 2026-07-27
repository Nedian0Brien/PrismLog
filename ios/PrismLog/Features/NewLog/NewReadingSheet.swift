import SwiftUI

/// Search a book, then start tracking it.
///
/// Search runs through the backend because the 네이버/카카오 keys live there —
/// the app cannot query those providers directly.
struct NewReadingSheet: View {
    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: [BookSearchItem] = []
    @State private var searching = false
    @State private var searchError: String?

    @State private var selected: BookSearchItem?
    @State private var enrichment: BookEnrichment?
    @State private var pagesTotal = ""
    @State private var pagesRead = ""
    @State private var medium: ReadingMedium = .paper
    @State private var ebookService: EbookService?
    @State private var status: ReadingStatus = .reading
    @State private var rating = 0
    @State private var review = ""
    @State private var memo = ""
    @State private var tagInput = ""
    @State private var saving = false

    private let api = PrismAPIClient.shared

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .reading)

                Group {
                    if let selected {
                        detailForm(for: selected)
                    } else {
                        searchList
                    }
                }
            }
            .navigationTitle(selected == nil ? "책 검색" : "읽기 시작")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
            }
        }
    }

    // MARK: - Search

    private var searchList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if searching {
                    ProgressView().padding(.top, 40)
                } else if let searchError {
                    PrismPlaceholderCard(
                        accent: .movie,
                        title: "검색에 실패했습니다",
                        detail: searchError
                    )
                } else if results.isEmpty, !query.isEmpty {
                    PrismPlaceholderCard(
                        accent: .reading,
                        title: "결과가 없습니다",
                        detail: "제목의 일부나 ISBN으로 다시 검색해 보세요."
                    )
                } else if results.isEmpty {
                    PrismPlaceholderCard(
                        accent: .reading,
                        title: "읽을 책을 찾아보세요",
                        detail: "제목이나 ISBN을 입력하면 표지와 쪽수까지 함께 가져옵니다."
                    )
                }

                ForEach(results) { book in
                    Button {
                        Task { await choose(book) }
                    } label: {
                        resultRow(book)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("booksearch.result")
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        // Applied here rather than to the whole stack: while the search field is
        // active the navigation bar hides every other item, which would swallow
        // the form's actions once a book is picked.
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "제목 또는 ISBN"
        )
        .task(id: query) { await runSearch() }
    }

    private func resultRow(_ book: BookSearchItem) -> some View {
        HStack(spacing: 12) {
            CoverImage(url: book.coverURL, accent: .reading)
                .frame(width: 48, height: 70)

            VStack(alignment: .leading, spacing: 4) {
                Text(book.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if !book.authorLine.isEmpty {
                    Text(book.authorLine)
                        .font(.prismMicro)
                        .prismMuted()
                        .lineLimit(1)
                }

                if let publisher = book.publisher {
                    Text(publisher)
                        .font(.prismMicro)
                        .prismMuted()
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: PrismAccent.reading.color, padding: 12)
    }

    private func runSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            results = []
            searchError = nil
            return
        }

        // Debounce — `.task(id:)` restarts on every keystroke, and this sleep
        // gets cancelled with it.
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }

        searching = true
        searchError = nil
        defer { searching = false }

        do {
            results = try await api.searchBooks(query: trimmed)
        } catch is CancellationError {
            return
        } catch {
            results = []
            searchError = error.localizedDescription
        }
    }

    // MARK: - Form

    private func choose(_ book: BookSearchItem) async {
        PrismHaptics.selection()
        selected = book
        pagesTotal = book.pagesTotal.map(String.init) ?? ""
        pagesRead = "0"

        // Search results usually lack a page count; without one there is no
        // progress to track, so fill it in from the enrichment providers.
        guard book.pagesTotal == nil, let isbn = book.isbn13 ?? book.isbn else { return }

        enrichment = try? await api.enrichBook(isbn: isbn)
        if let pages = enrichment?.pagesTotal, pagesTotal.isEmpty {
            pagesTotal = String(pages)
        }
    }

    private func detailForm(for book: BookSearchItem) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    CoverImage(url: book.coverURL, accent: .reading)
                        .frame(width: 92, height: 134)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(book.title)
                            .font(.prismTitle)
                            .foregroundStyle(PrismColor.text)
                            .fixedSize(horizontal: false, vertical: true)

                        if !book.authorLine.isEmpty {
                            Text(book.authorLine)
                                .font(.prismCaption)
                                .prismMuted()
                        }
                    }

                    Spacer(minLength: 0)
                }

                VStack(spacing: 12) {
                    field("전체 쪽수", text: $pagesTotal, placeholder: "예: 320")
                    field("현재 쪽수", text: $pagesRead, placeholder: "0")

                    if Int(pagesTotal) == nil {
                        Text("전체 쪽수를 입력해야 진도를 계산할 수 있습니다.")
                            .font(.prismMicro)
                            .foregroundStyle(PrismAccent.study.color)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .prismGlassCard()

                mediumCard
                statusAndRatingCard
                notesCard

                Button {
                    Task { await save() }
                } label: {
                    Text(saving ? "저장 중…" : "이 책 기록 시작")
                        .font(.prismHeadline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.glassProminent)
                .tint(PrismAccent.reading.color)
                .disabled(saving || Int(pagesTotal) == nil)
                .accessibilityIdentifier("booksearch.save")

                Button {
                    selected = nil
                    enrichment = nil
                } label: {
                    Text("다른 책 고르기")
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

    private var mediumCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("매체 유형")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Picker("매체 유형", selection: $medium) {
                ForEach(ReadingMedium.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            if medium == .ebook {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(EbookService.allCases) { service in
                            chip(service.label, isOn: ebookService == service) {
                                ebookService = ebookService == service ? nil : service
                            }
                        }
                    }
                    .padding(.horizontal, 1)
                }
                .scrollIndicators(.hidden)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var statusAndRatingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("상태")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Picker("상태", selection: $status) {
                ForEach(ReadingStatus.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)

            Divider().overlay(PrismColor.hairline)

            HStack {
                Text("별점")
                    .font(.prismCallout)
                    .prismMuted()
                Spacer(minLength: 0)
                StarRatingPicker(rating: $rating, accent: .reading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            labeledField("한 줄 평", text: $review, placeholder: "이 책을 한 마디로…")
            Divider().overlay(PrismColor.hairline)
            labeledField("메모 · 필사", text: $memo, placeholder: "기억하고 싶은 문장이나 생각…", multiline: true)
            Divider().overlay(PrismColor.hairline)
            labeledField("태그", text: $tagInput, placeholder: "#자기계발 #소설")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func labeledField(
        _ label: String,
        text: Binding<String>,
        placeholder: String,
        multiline: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.prismCaption)
                .prismMuted()

            TextField(placeholder, text: text, axis: multiline ? .vertical : .horizontal)
                .lineLimit(multiline ? 3...6 : 1...1)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chip(_ label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.prismCaption)
                .foregroundStyle(isOn ? PrismAccent.reading.color : PrismColor.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background {
                    Capsule().fill(PrismAccent.reading.color.opacity(isOn ? 0.16 : 0.04))
                }
                .overlay {
                    Capsule().stroke(
                        isOn ? PrismAccent.reading.color.opacity(0.55) : PrismColor.hairline,
                        lineWidth: 1
                    )
                }
        }
        .buttonStyle(.plain)
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        HStack {
            Text(label)
                .font(.prismCallout)
                .prismMuted()
                .frame(width: 84, alignment: .leading)

            TextField(placeholder, text: text)
                .keyboardType(.numberPad)
                .font(PrismFont.numeral(17, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.trailing)
        }
    }

    private func save() async {
        guard let selected, let total = Int(pagesTotal) else { return }
        saving = true
        defer { saving = false }

        await store.createReadingRecord(
            from: selected,
            enrichment: enrichment,
            draft: ReadingDraft(
                pagesTotal: total,
                pagesRead: Int(pagesRead) ?? 0,
                medium: medium,
                ebookService: ebookService,
                status: status,
                rating: rating,
                review: review.trimmingCharacters(in: .whitespacesAndNewlines),
                memo: memo,
                tags: parseTagInput(tagInput)
            )
        )

        PrismHaptics.saved()
        dismiss()
    }
}
