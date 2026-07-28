import SwiftUI

/// The records tab. Two levels, like the web: a hub of five shelves, and the
/// shelf you picked. Ported from `RecordsPage`
/// (`src/features/prismlog/pages/recordsPage.jsx:5481`).
struct RecordsScreen: View {
    @Environment(PrismStore.self) private var store

    /// `nil` is the hub. Kept as state rather than a navigation push so the
    /// hub↔shelf move can cross-fade the way the web's pane transition does.
    @State private var section: PrismAccent?
    @State private var hubColumns = 1
    @State private var readingGrid = false

    @State private var editing: RecordItem?
    @State private var loggingProgress: RecordItem?

    var body: some View {
        PrismScreenScaffold(
            eyebrow: "Records",
            title: section?.label ?? "기록 허브",
            focus: section,
            backLabel: section == nil ? nil : "기록 허브",
            onBack: { section = nil },
            headerAccessory: section == nil ? AnyView(columnToggle) : nil,
            onRefresh: { await store.sync() }
        ) {
            Group {
                if let section {
                    shelf(section)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                } else {
                    hub
                        .transition(.asymmetric(
                            insertion: .move(edge: .leading).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                }
            }
            .animation(PrismMotion.screen, value: section)
            .navigationDestination(for: UUID.self) { id in
                if let record = store.record(id: id) {
                    RecordDetailScreen(recordID: record.id)
                }
            }
            .sheet(item: $editing) { record in
                switch record.category {
                case .reading: ReadingEditSheet(record: record)
                case .study: StudyEditSheet(record: record)
                default: CultureEditSheet(record: record)
                }
            }
            .sheet(item: $loggingProgress) { record in
                switch record.category {
                case .reading: ReadingProgressSheet(record: record)
                case .study: StudyProgressSheet(record: record)
                default: GameSessionSheet(record: record)
                }
            }
        }
    }

    // MARK: - Hub

    private var hub: some View {
        PrismGlassSection {
            LazyVGrid(
                columns: Array(
                    repeating: GridItem(.flexible(), spacing: 12),
                    count: hubColumns
                ),
                spacing: 12
            ) {
                ForEach(RecordSection.sections(from: store)) { area in
                    RecordAreaCard(section: area, singleColumn: hubColumns == 1) {
                        PrismHaptics.selection()
                        section = area.accent
                    }
                }
            }
        }
    }

    private var columnToggle: some View {
        HStack(spacing: 8) {
            columnButton(1, symbol: "list.bullet", label: "1열")
            columnButton(2, symbol: "square.grid.2x2", label: "2열")
        }
    }

    private func columnButton(_ count: Int, symbol: String, label: String) -> some View {
        let isOn = hubColumns == count

        return Button {
            withAnimation(PrismMotion.snappy) { hubColumns = count }
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isOn ? PrismAccent.reading.color : PrismColor.textMuted)
                .frame(width: 36, height: 36)
                .background {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(PrismAccent.reading.color.opacity(isOn ? 0.09 : 0.02))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(
                            isOn ? PrismAccent.reading.color.opacity(0.4) : PrismColor.hairline,
                            lineWidth: 1
                        )
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) 보기")
        .accessibilityIdentifier("records.columns.\(count)")
    }

    // MARK: - Shelves

    @ViewBuilder
    private func shelf(_ accent: PrismAccent) -> some View {
        switch accent {
        case .reading: readingShelf
        case .study: studyShelf
        case .movie, .series, .game: cultureShelf(accent)
        }
    }

    @ViewBuilder
    private var readingShelf: some View {
        let books = store.records(in: .reading)

        VStack(spacing: 16) {
            shelfBar(count: books.count, unit: "권", accent: .reading) {
                AnyView(viewModeToggle)
            }

            if books.isEmpty {
                emptyShelf(.reading)
            } else if readingGrid {
                PrismGlassSection {
                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)],
                        spacing: 14
                    ) {
                        ForEach(books) { book in
                            NavigationLink(value: book.id) {
                                ReadingShelfCard(book: book)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else {
                PrismGlassSection {
                    LazyVStack(spacing: 14) {
                        ForEach(books) { book in
                            NavigationLink(value: book.id) {
                                ReadingListCard(
                                    book: book,
                                    onEdit: { editing = book },
                                    onLogProgress: { loggingProgress = book }
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("records.item")
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var studyShelf: some View {
        let groups = StudyGrouping.groups(from: store.records(in: .study))

        VStack(spacing: 16) {
            shelfBar(count: groups.count, unit: "개", accent: .study, accessory: nil)

            if groups.isEmpty {
                emptyShelf(.study)
            } else {
                PrismGlassSection {
                    LazyVStack(spacing: 14) {
                        ForEach(groups) { group in
                            NavigationLink(value: group.id) {
                                StudyListCard(
                                    group: group,
                                    onEdit: { editing = group.latest },
                                    onLogProgress: { loggingProgress = group.latest }
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("records.item")
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cultureShelf(_ accent: PrismAccent) -> some View {
        let type: CultureType = switch accent {
        case .series: .series
        case .game: .game
        default: .movie
        }
        let items = store.records(in: .culture).filter { $0.cultureType == type }

        VStack(spacing: 16) {
            shelfBar(count: items.count, unit: accent == .game ? "개" : "편", accent: accent, accessory: nil)

            if items.isEmpty {
                emptyShelf(accent)
            } else {
                PrismGlassSection {
                    LazyVStack(spacing: 14) {
                        ForEach(items) { item in
                            NavigationLink(value: item.id) {
                                CultureListCard(
                                    record: item,
                                    onEdit: { editing = item },
                                    onLogSession: accent == .game ? { loggingProgress = item } : nil
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("records.item")
                        }
                    }
                }
            }
        }
    }

    /// The web repeats the shelf's own title and count above its list, below
    /// the section header — kept so the counting word stays visible.
    private func shelfBar(
        count: Int,
        unit: String,
        accent: PrismAccent,
        accessory: (() -> AnyView)? = nil
    ) -> some View {
        HStack(spacing: 10) {
            Image(systemName: accent.symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(accent.color)

            Text("\(accent.label) 기록")
                .font(.prismTitle)
                .foregroundStyle(PrismColor.text)

            Spacer(minLength: 0)

            Text("\(count)\(unit)")
                .font(.prismCaption)
                .monospacedDigit()
                .prismMuted()

            if let accessory {
                accessory()
            }
        }
    }

    private var viewModeToggle: some View {
        Button {
            withAnimation(PrismMotion.snappy) { readingGrid.toggle() }
        } label: {
            Image(systemName: readingGrid ? "square.grid.2x2.fill" : "list.bullet")
                .font(.system(size: 14, weight: .semibold))
                .frame(width: 20, height: 20)
                .padding(9)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .tint(PrismAccent.reading.color)
        .accessibilityLabel(readingGrid ? "목록으로 보기" : "표지로 보기")
        .accessibilityIdentifier("records.viewToggle")
    }

    private func emptyShelf(_ accent: PrismAccent) -> some View {
        PrismGlassSection {
            PrismPlaceholderCard(
                accent: accent,
                title: "\(accent.label) 기록이 없습니다",
                detail: "오른쪽 아래 + 버튼으로 새 기록을 남겨 보세요."
            )
        }
    }
}

/// Reading's cover-first grid — the spines are the point.
struct ReadingShelfCard: View {
    let book: RecordItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HalfDonutCoverChart(
                url: book.coverURL,
                progress: book.progress,
                accent: .reading
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

#Preview {
    RecordsScreen()
        .environment(PrismStore.preview())
}
