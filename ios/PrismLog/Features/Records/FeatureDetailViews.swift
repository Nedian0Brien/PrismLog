import SwiftUI

// Reading, film and game details, laid out as the web lays them out
// (user decision 2026-11-20: "영화·게임·도서 상세도 웹 구성과 비교해 다른
// 곳을 맞춥니다"). Each opens with the web's `FeatureDetailHeroShell`
// (`recordsPage.jsx:689`): the artwork, then the title block and the cards
// that belong to it.

extension EnvironmentValues {
    /// Whether a detail hero lays out as the web's phone layout: one column.
    @Entry var detailIsCompact = true
}

/// Cells one per row in the web's phone layout, side by side otherwise.
/// Reads the layout inside the hero, where `detailIsCompact` is set.
struct DetailColumns<Content: View>: View {
    var spacing: CGFloat = 12
    @ViewBuilder var content: Content

    @Environment(\.detailIsCompact) private var compact

    var body: some View {
        if compact {
            VStack(alignment: .leading, spacing: spacing) { content }
        } else {
            HStack(alignment: .top, spacing: spacing) { content }
        }
    }
}

/// The web's hero shell: the cover centred above the title on a phone, or
/// beside it where there is room.
struct FeatureDetailHero<Content: View>: View {
    let record: RecordItem
    @ViewBuilder var content: Content

    @State private var width: CGFloat = 0
    private var isPhone: Bool { width < 720 }

    var body: some View {
        Group {
            if isPhone {
                VStack(alignment: .leading, spacing: 18) {
                    cover.frame(width: 232).frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 14) { content }
                }
            } else {
                HStack(alignment: .top, spacing: 18) {
                    cover.frame(width: 280).frame(width: 296)
                    VStack(alignment: .leading, spacing: 14) { content }
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .environment(\.detailIsCompact, isPhone)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .prismGlassCard(tint: record.accent.color, padding: isPhone ? 16 : 22)
    }

    private var cover: some View {
        CoverImage(url: record.coverURL, accent: record.accent, title: record.title, cornerRadius: 18)
            .aspectRatio(2.0 / 3.0, contentMode: .fit)
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(record.accent.color.opacity(0.14))
            }
            .shadow(color: .black.opacity(0.24), radius: 16, y: 14)
    }
}

/// Small pieces the detail heroes share.
enum DetailParts {
    static func eyebrow(_ text: String, accent: Color) -> some View {
        Text(text)
            .font(PrismFont.text(12, .semiBold))
            .tracking(1.2)
            .textCase(.uppercase)
            .foregroundStyle(accent)
    }

    static func title(_ text: String) -> some View {
        Text(text)
            .font(PrismFont.text(24, .extraBold, relativeTo: .title))
            .foregroundStyle(PrismColor.text)
            .fixedSize(horizontal: false, vertical: true)
    }

    static func chip(_ text: String, accent: Color) -> some View {
        Text(text)
            .font(PrismFont.text(11, .semiBold))
            .foregroundStyle(accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background { Capsule().fill(accent.opacity(0.13)) }
            .overlay { Capsule().strokeBorder(accent.opacity(0.2)) }
    }

    /// A tinted inset panel, as the web draws its status and metric boxes.
    static func panel<Content: View>(accent: Color, @ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(colors: [accent.opacity(0.08), Color.white.opacity(0.03)], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: .rect(cornerRadius: 18, style: .continuous)
            )
            .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.13)) }
    }

    /// A section card's heading: an eyebrow over a title, with an action.
    static func sectionHeader(
        eyebrow: String,
        title: String,
        accent: Color,
        action: (label: String, identifier: String, run: () -> Void)? = nil
    ) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Self.eyebrow(eyebrow, accent: accent)
                Text(title)
                    .font(PrismFont.text(22, .extraBold, relativeTo: .title2))
                    .foregroundStyle(PrismColor.text)
            }
            Spacer(minLength: 0)
            if let action {
                Button(action.label, action: action.run)
                    .font(PrismFont.text(12, .bold))
                    .buttonStyle(.glass)
                    .tint(accent)
                    .accessibilityIdentifier(action.identifier)
            }
        }
    }

    /// The web's `formatDurationLabel`: "45분", "2시간", "1시간 5분".
    static func duration(_ minutes: Int) -> String {
        guard minutes > 0 else { return "0분" }
        guard minutes >= 60 else { return "\(minutes)분" }
        let rest = minutes % 60
        return rest > 0 ? "\(minutes / 60)시간 \(rest)분" : "\(minutes / 60)시간"
    }

    /// The web's `formatTimeLabel`: "09:05".
    static func time(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}

// MARK: - Trend

/// One point of a progress trend.
struct TrendPoint: Identifiable, Equatable {
    let id: String
    let label: String
    let progress: Int
}

/// The web's `SeriesProgressTrendChart` (`recordsPage.jsx:949`), shared by
/// series and books: a dashed 0·50·100 grid, the line over a soft fill, a
/// ring at each point, the range above and the latest percent below.
struct ProgressTrendCard: View {
    let points: [TrendPoint]
    var accent: Color = PrismAccent.series.color
    var labelColor: Color = PrismColor.textMuted
    var gridColor: Color = Color.white.opacity(0.07)

    var body: some View {
        if let first = points.first, let last = points.last {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("Progress Trend")
                        .font(PrismFont.text(11, .semiBold))
                        .tracking(1)
                        .textCase(.uppercase)
                        .foregroundStyle(accent)
                    Spacer(minLength: 0)
                    Text("\(first.label) → \(last.label)")
                        .font(PrismFont.text(11))
                        .foregroundStyle(labelColor)
                }

                chart
                    .aspectRatio(220.0 / 104.0, contentMode: .fit)
                    .accessibilityLabel("진행률 추세")

                HStack {
                    Text(first.label)
                        .font(PrismFont.text(11))
                        .foregroundStyle(labelColor)
                    Spacer(minLength: 0)
                    Text("\(last.progress)%")
                        .font(PrismFont.numeral(11, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(accent)
                        .contentTransition(.numericText(value: Double(last.progress)))
                        .animation(.easeOut(duration: 0.46), value: last.progress)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(accent.opacity(0.13)) }
        }
    }

    /// Drawn in the web's 220×104 frame with 14pt insets, scaled to fit.
    private var chart: some View {
        GeometryReader { proxy in
            let scale = proxy.size.width / 220
            let inset = 14 * scale
            let width = proxy.size.width - inset * 2
            let height = proxy.size.height - inset * 2
            let last = max(points.count - 1, 1)
            let spots = points.enumerated().map { index, point in
                CGPoint(
                    x: inset + width * (points.count == 1 ? 0.5 : CGFloat(index) / CGFloat(last)),
                    y: inset + height - CGFloat(point.progress) / 100 * height
                )
            }

            ZStack {
                ForEach([0, 50, 100], id: \.self) { value in
                    Path { path in
                        let y = inset + height - CGFloat(value) / 100 * height
                        path.move(to: CGPoint(x: inset, y: y))
                        path.addLine(to: CGPoint(x: inset + width, y: y))
                    }
                    .stroke(gridColor, style: StrokeStyle(lineWidth: 1, dash: [3, 5]))
                }

                Path { path in
                    guard let start = spots.first, let end = spots.last else { return }
                    path.addLines(spots)
                    path.addLine(to: CGPoint(x: end.x, y: inset + height))
                    path.addLine(to: CGPoint(x: start.x, y: inset + height))
                    path.closeSubpath()
                }
                .fill(LinearGradient(colors: [accent.opacity(0.33), accent.opacity(0.02)], startPoint: .top, endPoint: .bottom))

                Path { path in path.addLines(spots) }
                    .stroke(accent, style: StrokeStyle(lineWidth: 3 * scale, lineCap: .round, lineJoin: .round))

                ForEach(Array(spots.enumerated()), id: \.offset) { _, spot in
                    Circle()
                        .fill(PrismColor.background)
                        .overlay { Circle().strokeBorder(accent, lineWidth: 2 * scale) }
                        .frame(width: 9 * scale, height: 9 * scale)
                        .position(spot)
                }
            }
        }
    }
}

/// A donut with TOTAL and the percent inside, as the web's detail pages draw
/// it next to their trend.
struct TotalDonut: View {
    let progress: Int
    let accent: Color
    var diameter: CGFloat = 118
    var lineWidth: CGFloat = 11

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.08), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(min(max(progress, 0), 100)) / 100)
                .stroke(accent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("TOTAL")
                    .font(PrismFont.text(12))
                    .prismMuted()
                Text("\(progress)%")
                    .font(PrismFont.numeral(28, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(accent)
            }
        }
        .frame(width: diameter, height: diameter)
        .animation(PrismMotion.meter, value: progress)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("전체 진행률 \(progress)퍼센트")
    }
}

// MARK: - Reading

/// A book's detail — the web's `ReadingDetailPage` (`recordsPage.jsx:2784`):
/// the hero with progress, synopsis and review; the trend beside the total
/// donut; the reading timeline by day; and the reading feed of notes.
struct ReadingDetailContent: View {
    let record: RecordItem
    var onAddProgress: () -> Void
    var onAddNote: () -> Void

    @State private var descriptionExpanded = false

    static let accent = Color(hex: 0x2DB5A3)
    /// The web's `COLORS.reading.progressSoft`.
    static let soft = Color(hex: 0x8BE5D8)
    private var accent: Color { Self.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            hero
            trendCard
            timelineCard
            feedCard
        }
    }

    // MARK: Hero

    private var hero: some View {
        FeatureDetailHero(record: record) {
            VStack(alignment: .leading, spacing: 6) {
                DetailParts.eyebrow("Reading Detail", accent: accent)
                DetailParts.title(record.title)
                Text(record.author?.isEmpty == false ? record.author! : "저자 정보 없음")
                    .font(PrismFont.text(13))
                    .prismMuted()
            }

            let chips = [record.publisher, record.publishedDate.flatMap(SeriesDates.monthDay)]
                .compactMap { $0 }.filter { !$0.isEmpty } + record.tags.map { "#\($0)" }
            if !chips.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(chips, id: \.self) { DetailParts.chip($0, accent: accent) }
                }
            }

            DetailParts.panel(accent: accent) {
                VStack(spacing: 10) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Reading progress").font(PrismFont.text(11)).prismMuted()
                            Text("\(record.progress)%")
                                .font(PrismFont.numeral(26, weight: .heavy))
                                .monospacedDigit()
                                .foregroundStyle(accent)
                        }
                        Spacer(minLength: 0)
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("Pages").font(PrismFont.text(11)).prismMuted()
                            Text("\(record.pagesRead)/\(record.pagesTotal)p")
                                .font(PrismFont.numeral(15, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(PrismColor.text)
                        }
                    }
                    ProgressMeter(value: Double(record.progress) / 100, accent: .reading, height: 8)
                }
            }

            if let description = record.payload.string("description"), !description.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text(description)
                        .font(PrismFont.text(13))
                        .lineSpacing(5)
                        .prismMuted()
                        .lineLimit(descriptionExpanded ? nil : 5)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        withAnimation(PrismMotion.snappy) { descriptionExpanded.toggle() }
                    } label: {
                        Label(descriptionExpanded ? "접기" : "펼치기", systemImage: "chevron.down")
                            .labelStyle(ChevronLabelStyle(flipped: descriptionExpanded))
                            .font(PrismFont.text(12, .bold))
                            .foregroundStyle(accent)
                    }
                    .buttonStyle(.plain)
                }
            }

            if !record.review.isEmpty {
                Text("\u{201C}\(record.review)\u{201D}")
                    .font(PrismFont.text(12))
                    .italic()
                    .lineSpacing(4)
                    .prismMuted()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 16, style: .continuous))
            }

            HStack(spacing: 10) {
                Button("+ 독서 기록 추가", action: onAddProgress)
                    .buttonStyle(.glass)
                    .tint(accent)
                    .accessibilityIdentifier("reading.addProgress")
                Button("+ 독서 메모", action: onAddNote)
                    .buttonStyle(.glass)
                    .tint(PrismColor.text)
                    .accessibilityIdentifier("reading.addNote")
            }
            .font(PrismFont.text(13, .bold))
            .controlSize(.large)
        }
    }

    // MARK: Trend

    private var trendCard: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 18) {
                ProgressTrendCard(points: trendPoints, accent: accent, labelColor: Self.soft, gridColor: accent.opacity(0.14))
                    .frame(minWidth: 360)
                donutColumn.frame(width: 158)
            }
            VStack(spacing: 18) {
                ProgressTrendCard(points: trendPoints, accent: accent, labelColor: Self.soft, gridColor: accent.opacity(0.14))
                donutColumn
            }
        }
        .frame(maxWidth: .infinity)
        .prismGlassCard(tint: accent, padding: 16)
    }

    private var donutColumn: some View {
        VStack(spacing: 8) {
            TotalDonut(progress: record.progress, accent: accent)
            Text("\(record.pagesRead)/\(record.pagesTotal)p")
                .font(PrismFont.text(12))
                .prismMuted()
        }
    }

    /// The web's `buildReadingTrendPoints` (`recordsPage.jsx:2309`): each
    /// session's start, when it doesn't continue the last, and its end.
    var trendPoints: [TrendPoint] {
        Self.trendPoints(for: record)
    }

    static func trendPoints(for record: RecordItem) -> [TrendPoint] {
        let sessions = record.readingSessions.sorted { ($0.date ?? .distantPast) < ($1.date ?? .distantPast) }
        guard !sessions.isEmpty else {
            return [TrendPoint(id: "reading-current", label: "현재", progress: min(max(record.progress, 0), 100))]
        }
        var points: [TrendPoint] = []
        for (index, session) in sessions.enumerated() {
            let label = session.date.map(SeriesDates.monthDay) ?? "기록"
            let start = min(max(session.fromProgress, 0), 100)
            let end = min(max(session.toProgress, 0), 100)
            if let previous = points.last, abs(previous.progress - start) <= 0 {
                // Continues where the last one ended.
            } else {
                points.append(TrendPoint(id: "\(index)-start", label: label, progress: start))
            }
            points.append(TrendPoint(id: "\(index)-end", label: label, progress: end))
        }
        return points
    }

    // MARK: Timeline

    /// One day of reading: its session and the notes written that day.
    struct DayGroup: Identifiable {
        let day: Date
        var session: ReadingSession?
        var notes: [ReadingNote]

        var id: Date { day }
    }

    /// The web's `buildReadingTimelineGroups` (`recordsPage.jsx:2486`):
    /// newest day first, the day's session (the last one read), and its
    /// notes newest first.
    static func dayGroups(for record: RecordItem, calendar: Calendar = .current) -> [DayGroup] {
        var groups: [Date: DayGroup] = [:]
        // Oldest first, so the day keeps its latest session, as the web's
        // stored order does; the model sorts newest first.
        for session in record.readingSessions.sorted(by: { ($0.date ?? .distantPast) < ($1.date ?? .distantPast) }) {
            guard let date = session.date else { continue }
            let day = calendar.startOfDay(for: date)
            groups[day, default: DayGroup(day: day, session: nil, notes: [])].session = session
        }
        for note in record.readingNotes {
            guard let date = note.date else { continue }
            let day = calendar.startOfDay(for: date)
            groups[day, default: DayGroup(day: day, session: nil, notes: [])].notes.append(note)
        }
        return groups.values
            .map { group in
                var sorted = group
                sorted.notes.sort { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
                return sorted
            }
            .sorted { $0.day > $1.day }
    }

    private var timelineCard: some View {
        let groups = Self.dayGroups(for: record)
        return VStack(alignment: .leading, spacing: 16) {
            DetailParts.sectionHeader(eyebrow: "Reading Timeline", title: "독서 타임라인", accent: accent)

            if groups.isEmpty {
                Text("아직 독서 기록이나 메모가 없습니다.")
                    .font(PrismFont.text(13))
                    .prismMuted()
            } else {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(groups) { group in
                        dayEntry(group)
                    }
                }
                .background(alignment: .leading) {
                    Capsule()
                        .fill(LinearGradient(colors: [accent.opacity(0.8), accent.opacity(0.27)], startPoint: .top, endPoint: .bottom))
                        .frame(width: 2)
                        .shadow(color: accent.opacity(0.13), radius: 9)
                        .padding(.leading, 17)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: accent, padding: 16)
    }

    private func dayEntry(_ group: DayGroup) -> some View {
        let calendar = Calendar.current
        let parts = calendar.dateComponents([.month, .day, .weekday], from: group.day)
        let weekday = ["일", "월", "화", "수", "목", "금", "토"][(parts.weekday ?? 1) - 1]

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(String(format: "%02d", parts.day ?? 0))
                    .font(PrismFont.numeral(34, weight: .heavy))
                    .tracking(-2)
                    .foregroundStyle(PrismColor.text)
                Text("\(parts.month ?? 0)월 · \(weekday)요일")
                    .font(PrismFont.text(12))
                    .prismMuted()
            }
            .padding(.top, 6)

            if let session = group.session {
                sessionCard(session)
            }
            if let note = group.notes.first {
                noteSnippet(note, count: group.notes.count)
            }
        }
        .padding(.leading, 38)
        .overlay(alignment: .topLeading) {
            Circle()
                .fill(LinearGradient(colors: [Self.soft, accent], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 14, height: 14)
                .overlay { Circle().strokeBorder(PrismColor.background, lineWidth: 2) }
                .background { Circle().fill(accent.opacity(0.07)).padding(-6) }
                .shadow(color: accent.opacity(0.13), radius: 9)
                .padding(.leading, 11)
                .padding(.top, 18)
        }
    }

    private func sessionCard(_ session: ReadingSession) -> some View {
        let total = min(max(session.toProgress, 0), 100)
        let start = min(max(session.fromProgress, 0), 100)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Today's Progress")
                        .font(PrismFont.text(11))
                        .tracking(0.5)
                        .textCase(.uppercase)
                        .prismMuted()
                    Text("+\(session.pagesRead)p 읽음")
                        .font(PrismFont.text(22, .extraBold))
                        .foregroundStyle(PrismColor.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("+\(max(0, total - start))%")
                        .font(PrismFont.numeral(14, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.9))
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text("\(total)").font(PrismFont.numeral(42, weight: .heavy))
                        Text("%").font(PrismFont.numeral(18, weight: .heavy))
                    }
                    .monospacedDigit()
                    .foregroundStyle(accent)
                }
                .fixedSize()
            }

            VStack(alignment: .leading, spacing: 8) {
                DeltaProgressBar(value: total, start: start, accent: accent, delta: Self.soft)
                Text("\(session.fromPages)p → \(session.toPages)p (+\(session.pagesRead)p)")
                    .font(PrismFont.text(12))
                    .prismMuted()
            }

            if !session.photos.isEmpty {
                PhotoStrip(photos: session.photos, accent: .reading, height: 84)
            }
        }
        .padding(16)
        .background(
            LinearGradient(colors: [Color.white.opacity(0.03), accent.opacity(0.07)], startPoint: .top, endPoint: .bottom),
            in: .rect(cornerRadius: 22, style: .continuous)
        )
        .overlay { RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(accent.opacity(0.17)) }
    }

    private func noteSnippet(_ note: ReadingNote, count: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                DetailParts.chip("메모 스니펫", accent: Self.soft)
                Text("\(count)개 메모")
                    .font(PrismFont.text(12))
                    .prismMuted()
                Spacer(minLength: 0)
                if let date = note.date {
                    Text(DetailParts.time(date))
                        .font(PrismFont.numeral(12, weight: .medium))
                        .prismMuted()
                }
            }
            Text(note.text)
                .font(PrismFont.text(13))
                .lineSpacing(4)
                .prismMuted()
                .lineLimit(2)
        }
        .padding(16)
        .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 22, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(PrismColor.hairline) }
    }

    // MARK: Feed

    private var feedCard: some View {
        let notes = record.readingNotes.sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
        return VStack(alignment: .leading, spacing: 16) {
            DetailParts.sectionHeader(
                eyebrow: "Reading Feed",
                title: "독서 피드",
                accent: accent,
                action: (label: "+ 독서 메모", identifier: "reading.feed.addNote", run: onAddNote)
            )

            if notes.isEmpty {
                Text("아직 남긴 독서 메모가 없습니다.")
                    .font(PrismFont.text(13))
                    .prismMuted()
            } else {
                VStack(spacing: 12) {
                    ForEach(notes) { note in
                        quote(note)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: accent, padding: 16)
    }

    private func quote(_ note: ReadingNote) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                DetailParts.chip("독서 메모", accent: Self.soft)
                if note.page > 0 {
                    Text("\(note.page)p")
                        .font(PrismFont.numeral(12, weight: .semibold))
                        .foregroundStyle(accent)
                }
                Spacer(minLength: 0)
                if let date = note.date {
                    Text("\(SeriesDates.monthDay(date)) · \(DetailParts.time(date))")
                        .font(PrismFont.text(12))
                        .prismMuted()
                }
            }
            Text(note.text)
                .font(PrismFont.text(14))
                .lineSpacing(8)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .topLeading) {
            Text("\u{201C}")
                .font(PrismFont.numeral(74, weight: .heavy))
                .foregroundStyle(accent.opacity(0.09))
                .offset(x: 12, y: -12)
                .accessibilityHidden(true)
        }
        .background(Color.white.opacity(0.03), in: .rect(cornerRadius: 22, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(accent.opacity(0.13)) }
    }
}

/// The web's `TimelineProgressBar` (`ui.jsx:91`): the total so far, with
/// the day's share lit brighter on top.
struct DeltaProgressBar: View {
    let value: Int
    let start: Int
    let accent: Color
    let delta: Color
    var height: CGFloat = 16

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let total = CGFloat(min(max(value, 0), 100)) / 100
            let from = CGFloat(min(max(start, 0), 100)) / 100
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))
                Capsule()
                    .fill(LinearGradient(
                        colors: value >= 100 ? [accent.opacity(0.52), accent] : [accent.opacity(0.27), accent.opacity(0.52)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: width * (shown ? total : 0))
                if total > from {
                    Capsule()
                        .fill(delta)
                        .frame(width: width * (shown ? total - from : 0))
                        .offset(x: width * from)
                }
            }
        }
        .frame(height: height)
        .clipShape(Capsule())
        .onAppear {
            if reduceMotion { shown = true } else { withAnimation(.spring(duration: 0.8).delay(0.1)) { shown = true } }
        }
        .accessibilityHidden(true)
    }
}

private struct ChevronLabelStyle: LabelStyle {
    let flipped: Bool

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
                .font(.system(size: 11, weight: .bold))
                .rotationEffect(.degrees(flipped ? 180 : 0))
            configuration.title
        }
    }
}

// MARK: - Film

/// A film's detail — the web's `MediaDetailPage` (`recordsPage.jsx:4646`).
struct MediaDetailContent: View {
    let record: RecordItem

    private var accent: Color { record.accent.color }

    var body: some View {
        FeatureDetailHero(record: record) {
            CultureTitleBlock(record: record, eyebrow: "Media Detail", meta: [
                record.cultureType?.rawValue,
                record.status,
                record.payload.string("playtime"),
                record.releaseDate.flatMap(SeriesDates.monthDay),
            ])

            if !record.tags.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(record.tags, id: \.self) { DetailParts.chip("#\($0)", accent: accent) }
                }
            }

            DetailParts.panel(accent: accent) {
                DetailColumns { statusCell; progressCell }
            }

            CultureSynopsis(record: record)
        }
    }

    private var statusCell: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("현재 상태").font(PrismFont.text(11)).prismMuted()
            Text(record.status?.isEmpty == false ? record.status! : "미설정")
                .font(PrismFont.text(20, .extraBold))
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var progressCell: some View {
        let playtime = record.payload.string("playtime") ?? ""
        let value = !playtime.isEmpty ? playtime : record.rating > 0 ? String(format: "%.1f / 5", Double(record.rating)) : "기록 대기"
        return VStack(alignment: .leading, spacing: 4) {
            Text("진행 정보").font(PrismFont.text(11)).prismMuted()
            Text(value)
                .font(PrismFont.numeral(20, weight: .bold))
                .foregroundStyle(accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The title block the film and game heroes share: eyebrow, title and a
/// meta line, with the status and stars at the right.
struct CultureTitleBlock: View {
    let record: RecordItem
    let eyebrow: String
    let meta: [String?]

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                DetailParts.eyebrow(eyebrow, accent: record.accent.color)
                DetailParts.title(record.title)
                let line = meta.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                if !line.isEmpty {
                    Text(line)
                        .font(PrismFont.text(13))
                        .prismMuted()
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 8) {
                if let status = record.status, !status.isEmpty {
                    SeriesStatusBadge(status: status)
                }
                if record.rating > 0 {
                    RatingStars(rating: record.rating, accent: .study, size: 14)
                }
            }
        }
    }
}

/// The record's own words, or the work's synopsis — the web shows
/// `summary || overview` in a glass panel at the foot of the hero.
struct CultureSynopsis: View {
    let record: RecordItem

    var body: some View {
        let text = !record.summary.isEmpty ? record.summary : (record.overview ?? "")
        if !text.isEmpty {
            Text(text)
                .font(PrismFont.text(14))
                .lineSpacing(8)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 18, style: .continuous))
        }
    }
}

// MARK: - Game

/// A game's hero — the web's `GameDetailPage` (`recordsPage.jsx:4726`):
/// title, status, last played, the three play numbers, tags and synopsis.
/// The calendar and play log follow it (`GameSessionsSection`).
struct GameDetailHero: View {
    let record: RecordItem

    private var accent: Color { PrismAccent.game.color }
    private var sessions: [GameSession] { record.gameSessions }
    private var lastPlayed: Date? { sessions.compactMap(\.playedAt).max() }

    var body: some View {
        FeatureDetailHero(record: record) {
            CultureTitleBlock(record: record, eyebrow: "Game Detail", meta: [
                record.status,
                record.releaseDate.flatMap(SeriesDates.monthDay),
                lastPlayed.map { "\(SeriesDates.monthDay($0)) 플레이" },
            ])

            GameMetrics(sessions: sessions, lastPlayed: lastPlayed)

            if !record.tags.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(record.tags, id: \.self) { DetailParts.chip("#\($0)", accent: accent) }
                }
            }

            CultureSynopsis(record: record)
        }
    }
}

/// The web's three play numbers: one per row on a phone, side by side
/// where there is room.
private struct GameMetrics: View {
    let sessions: [GameSession]
    let lastPlayed: Date?

    private var accent: Color { PrismAccent.game.color }

    var body: some View {
        DetailColumns { metrics }
    }

    @ViewBuilder
    private var metrics: some View {
        metric("누적 플레이", DetailParts.duration(sessions.reduce(0) { $0 + $1.durationMinutes }))
        metric("플레이 횟수", "\(sessions.count)회")
        metric("최근 플레이", lastPlayed.map(SeriesDates.monthDay) ?? "기록 대기")
    }

    private func metric(_ label: String, _ value: String) -> some View {
        DetailParts.panel(accent: accent) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(PrismFont.text(11)).prismMuted()
                Text(value)
                    .font(PrismFont.numeral(20, weight: .bold))
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
    }
}
