import SwiftUI

/// The five record shelves. Ported from `RecordsPage` in
/// `src/features/prismlog/pages/recordsPage.jsx`.
struct RecordsScreen: View {
    @Environment(PrismStore.self) private var store
    @State private var section: PrismAccent = .reading
    @State private var showsCovers = true

    var body: some View {
        PrismScreenScaffold(
            eyebrow: "Records",
            title: "기록",
            focus: section,
            onRefresh: { await store.sync() }
        ) {
            VStack(spacing: 16) {
                HStack(spacing: 10) {
                    sectionPicker

                    if section == .reading {
                        Button {
                            withAnimation(PrismMotion.snappy) { showsCovers.toggle() }
                        } label: {
                            Image(systemName: showsCovers ? "square.grid.2x2.fill" : "list.bullet")
                                .font(.system(size: 14, weight: .semibold))
                                .frame(width: 20, height: 20)
                                .padding(9)
                        }
                        .buttonStyle(.glass)
                        .buttonBorderShape(.circle)
                        .tint(PrismAccent.reading.color)
                        .accessibilityLabel(showsCovers ? "목록으로 보기" : "표지로 보기")
                        .accessibilityIdentifier("records.viewToggle")
                    }
                }

                if items.isEmpty {
                    PrismGlassSection {
                        PrismPlaceholderCard(
                            accent: section,
                            title: "\(section.label) 기록이 없습니다",
                            detail: "오른쪽 아래 + 버튼으로 새 기록을 남겨 보세요."
                        )
                    }
                } else if section == .reading, showsCovers {
                    ReadingShelf(books: items)
                } else {
                    PrismGlassSection {
                        VStack(spacing: 12) {
                            ForEach(items) { record in
                                NavigationLink(value: record.id) {
                                    RecordSummaryRow(record: record)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .navigationDestination(for: UUID.self) { id in
                if let record = store.record(id: id) {
                    RecordDetailScreen(recordID: record.id)
                }
            }
        }
    }

    private var sectionPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(PrismAccent.allCases) { accent in
                    let isOn = section == accent

                    Button {
                        withAnimation(PrismMotion.snappy) { section = accent }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: accent.symbol)
                                .font(.system(size: 12, weight: .semibold))
                            Text(accent.label)
                                .font(.prismCallout)
                        }
                        .foregroundStyle(isOn ? accent.color : PrismColor.textMuted)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background { Capsule().fill(accent.color.opacity(isOn ? 0.16 : 0.04)) }
                        .overlay {
                            Capsule().stroke(
                                isOn ? accent.color.opacity(0.55) : PrismColor.hairline,
                                lineWidth: 1
                            )
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("records.section.\(accent.rawValue)")
                }
            }
            .padding(.horizontal, 2)
        }
        .scrollIndicators(.hidden)
    }

    /// Culture records live under one `culture` category and are separated by
    /// their payload `type`, exactly as the web does it.
    private var items: [RecordItem] {
        switch section {
        case .reading: store.records(in: .reading)
        case .study: store.records(in: .study)
        case .movie: store.records(in: .culture).filter { $0.cultureType == .movie }
        case .series: store.records(in: .culture).filter { $0.cultureType == .series }
        case .game: store.records(in: .culture).filter { $0.cultureType == .game }
        }
    }
}

/// Reading gets a cover-first shelf — the spines are the point.
struct ReadingShelf: View {
    let books: [RecordItem]

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        PrismGlassSection {
            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(books) { book in
                    NavigationLink(value: book.id) {
                        ReadingShelfCard(book: book)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

struct ReadingShelfCard: View {
    let book: RecordItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ProgressWaterCover(
                url: book.coverURL,
                progress: book.progress,
                accent: .reading,
                width: 140
            )
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 4) {
                Text(book.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let author = book.author, !author.isEmpty {
                    Text(author)
                        .font(.prismMicro)
                        .prismMuted()
                        .lineLimit(1)
                }

                HStack(spacing: 6) {
                    Text("\(book.progress)%")
                        .font(PrismFont.numeral(13, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.reading.color)

                    if book.pagesTotal > 0 {
                        Text("· \(book.pagesRead)/\(book.pagesTotal)p")
                            .font(.prismMicro)
                            .prismMuted()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .prismGlassCard(tint: PrismAccent.reading.color, padding: 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(book.title), \(book.progress)퍼센트 읽음")
    }
}
