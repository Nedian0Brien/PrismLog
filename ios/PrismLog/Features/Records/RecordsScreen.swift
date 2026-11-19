import SwiftUI

/// The records tab. Two levels, like the web: a hub of five shelves, and the
/// shelf you picked. Ported from `RecordsPage`
/// (`src/features/prismlog/pages/recordsPage.jsx:5481`).
struct RecordsScreen: View {
    @Environment(PrismStore.self) private var store

    @Environment(AppNavigationModel.self) private var navigation

    /// `nil` is the hub. Kept as state rather than a navigation push so the
    /// hub↔shelf move can cross-fade the way the web's pane transition does.
    /// Held by the navigation model so it survives folding and unfolding.
    private var section: PrismAccent? {
        get { navigation.recordsSection }
        nonmutating set { navigation.recordsSection = newValue }
    }
    @State private var hubColumns = 1
    @State private var readingGrid = false

    @State private var editing: RecordItem?
    @State private var loggingProgress: RecordItem?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    private var isCompact: Bool { horizontalSizeClass != .regular }

    /// The sidebar width that puts the split on iPhone Duo's fold. The
    /// system doesn't snap a split view's columns to the fold on its own
    /// (checked on the iOS 27.2 iPhone Duo simulator, Phase 7), so the
    /// sidebar is offered the fold's leading edge as its ideal width.
    /// `nil` without a fold.
    @State private var foldSidebarWidth: CGFloat?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    /// Which column a collapsed (compact) split view shows.
    @State private var compactColumn: NavigationSplitViewColumn = .sidebar
    /// Set while the shell re-stacks the detail on the sidebar after a
    /// collapse, so the brief trip through `.sidebar` isn't read as "back".
    @State private var restacking = false
    static let defaultSidebarWidth: CGFloat = 340

    /// Always a split view (spec §6.2), never swapped for a stack.
    ///
    /// Folding iPhone Duo changes the size class. Swapping a stack for a
    /// split view at that moment rebuilt the whole tab, which dismissed any
    /// sheet or session open on a record and lost what was typed into it
    /// (Phase 7). A split view collapses to a stack by itself in compact
    /// width and keeps its columns' views — and their presentations —
    /// across the change. The cost is the list-to-detail zoom, which a
    /// split view doesn't offer.
    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility, preferredCompactColumn: $compactColumn) {
            scaffold
                .navigationSplitViewColumnWidth(
                    min: 280,
                    ideal: foldSidebarWidth ?? Self.defaultSidebarWidth,
                    max: max(foldSidebarWidth ?? 0, 480)
                )
        } detail: {
            splitDetail
        }
        .navigationSplitViewStyle(.balanced)
        .containerBackground(.clear, for: .navigationSplitView)
        .onGeometryChange(for: CGFloat?.self) { proxy in
            let width = proxy.size.width
            let divisions = proxy.reservedRegions(kind: .division, options: .includeInactive).map(\.frame)
            let split = ColumnSplit.make(width: width, height: proxy.size.height, divisions: divisions, spacing: 0)
            return split.followsFold ? split.leadingWidth : nil
        } action: { width in
            foldSidebarWidth = width
        }
        // Selection drives the collapsed column: a record shows its detail,
        // none shows the hub. Coming back to the sidebar in compact clears it.
        .onChange(of: navigation.paths[.records], initial: true) {
            compactColumn = navigation.paths[.records]?.last == nil ? .sidebar : .detail
        }
        .onChange(of: compactColumn) { _, column in
            guard isCompact, column == .sidebar, !restacking else { return }
            navigation.paths[.records] = []
        }
        .onChange(of: isCompact) { _, nowCompact in
            // Collapsing an expanded split view with a record selected shows
            // the detail as the stack's root, with no way back to the list
            // (iOS 27.2 iPhone Duo simulator, Phase 7). Showing the sidebar
            // and then the detail again stacks the detail on the sidebar,
            // which brings the back button.
            guard nowCompact, navigation.paths[.records]?.last != nil else { return }
            restacking = true
            compactColumn = .sidebar
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(80))
                compactColumn = .detail
                restacking = false
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

    private var scaffold: some View {
        PrismScreenScaffold(
            eyebrow: "Records",
            title: section?.label ?? "기록 허브",
            focus: section,
            backLabel: section == nil ? nil : "기록 허브",
            onBack: { section = nil },
            headerAccessory: section == nil ? AnyView(columnToggle) : nil,
            embedsInStack: false,
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
        }
    }

    /// The split view's detail column: the selected record, or a prompt to
    /// pick one. Reads the same selection the compact stack pushes, so
    /// folding and unfolding keeps the record open.
    @ViewBuilder
    private var splitDetail: some View {
        if let id = navigation.paths[.records]?.last {
            RecordDetailScreen(recordID: id)
                .id(id)
        } else {
            ContentUnavailableView(
                "기록을 고르세요",
                systemImage: "books.vertical",
                description: Text("목록에서 기록을 고르면 여기에 열립니다.")
            )
            .prismWallBackground()
        }
    }

    /// A card that opens a record: it selects it, and the split view shows
    /// it beside the list or, collapsed, on top of it.
    private func recordLink<Label: View>(_ id: UUID, @ViewBuilder label: () -> Label) -> some View {
        Button {
            navigation.paths[.records] = [id]
        } label: {
            label()
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
                            recordLink(book.id) {
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
                            recordLink(book.id) {
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
                            recordLink(group.id) {
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
                            recordLink(item.id) {
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
                title: book.title,
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
        .environment(AppNavigationModel())
}
