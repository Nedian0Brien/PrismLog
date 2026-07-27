import SwiftUI

/// Every record in one chronological thread. Ported from `TimelinePage`
/// (`src/features/prismlog/pages/timelinePage.jsx`).
struct TimelineScreen: View {
    @Environment(PrismStore.self) private var store

    enum Mode: String, CaseIterable, Identifiable {
        case feed, calendar

        var id: String { rawValue }
        var label: String { self == .feed ? "시간순 피드" : "캘린더" }
        var symbol: String { self == .feed ? "clock" : "calendar" }
    }

    @State private var mode: Mode = .feed

    var body: some View {
        PrismScreenScaffold(
            eyebrow: "Timeline",
            title: "타임라인",
            focus: .movie,
            onRefresh: { await store.sync() }
        ) {
            VStack(spacing: 18) {
                modePicker

                if days.isEmpty {
                    PrismGlassSection {
                        PrismPlaceholderCard(
                            accent: .movie,
                            title: store.hasLoadedOnce ? "기록이 없습니다" : "불러오는 중…",
                            detail: "기록을 남기면 발생한 시각 순서로 여기에 쌓입니다."
                        )
                    }
                } else {
                    switch mode {
                    case .feed: TimelineFeed(days: days)
                    case .calendar: TimelineCalendar(days: days)
                    }
                }
            }
            .animation(PrismMotion.snappy, value: mode)
        }
        .navigationDestination(for: UUID.self) { id in
            RecordDetailScreen(recordID: id)
        }
    }

    private var modePicker: some View {
        HStack(spacing: 8) {
            ForEach(Mode.allCases) { candidate in
                let isOn = mode == candidate

                Button {
                    withAnimation(PrismMotion.snappy) { mode = candidate }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: candidate.symbol)
                            .font(.system(size: 12, weight: .semibold))
                        Text(candidate.label)
                            .font(.prismCallout)
                    }
                    .foregroundStyle(isOn ? PrismAccent.movie.color : PrismColor.textMuted)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background { Capsule().fill(PrismAccent.movie.color.opacity(isOn ? 0.14 : 0.04)) }
                    .overlay {
                        Capsule().stroke(
                            isOn ? PrismAccent.movie.color.opacity(0.5) : PrismColor.hairline,
                            lineWidth: 1
                        )
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("timeline.mode.\(candidate.rawValue)")
            }

            Spacer(minLength: 0)
        }
    }

    private var days: [TimelineDay] {
        TimelineBuilder.days(from: store.records)
    }
}

// MARK: - Feed

/// The thread itself: a spectrum spine down the left, a node per day, and the
/// day's entries hanging off it.
struct TimelineFeed: View {
    let days: [TimelineDay]

    private let spineX: CGFloat = 17

    var body: some View {
        PrismGlassSection {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(days) { day in
                    dayBlock(day)
                }
            }
            .padding(.leading, 38)
            // The spine is drawn behind, spanning the whole run of days, so it
            // reads as one thread rather than one segment per day.
            .background(alignment: .topLeading) {
                LinearGradient(
                    colors: [
                        PrismAccent.reading.color.opacity(0.8),
                        PrismAccent.study.color.opacity(0.55),
                        PrismAccent.movie.color.opacity(0.4),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(width: 2)
                .clipShape(Capsule())
                .shadow(color: PrismAccent.reading.color.opacity(0.15), radius: 11)
                .offset(x: spineX)
            }
        }
    }

    private func dayBlock(_ day: TimelineDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(day.date, format: .dateTime.day(.twoDigits))
                    .font(PrismFont.numeral(34, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)

                Text(sideLabel(day.date))
                    .font(.prismCaption)
                    .prismMuted()

                Spacer(minLength: 0)
            }

            ForEach(day.items) { item in
                NavigationLink(value: item.recordID) {
                    TimelineEntryCard(item: item)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("timeline.item")
            }
        }
        // The node marks the day on the spine. Placed against the header row,
        // not the block, so it lines up with the date rather than floating.
        .overlay(alignment: .topLeading) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [PrismColor.text, PrismColor.textMuted],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 14, height: 14)
                .overlay { Circle().stroke(PrismColor.background, lineWidth: 2) }
                .shadow(color: PrismColor.text.opacity(0.28), radius: 9)
                .offset(x: -38 + spineX - 6, y: 14)
        }
    }

    private func sideLabel(_ date: Date) -> String {
        let month = Calendar.current.component(.month, from: date)
        let weekday = date.formatted(.dateTime.weekday(.wide))
        return "\(month)월 · \(weekday)"
    }
}

// MARK: - Entry card

struct TimelineEntryCard: View {
    let item: TimelineItem

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header

            if item.posterURL != nil {
                HStack(alignment: .top, spacing: 12) {
                    CoverImage(url: item.posterURL, accent: item.accent, cornerRadius: 10)
                        .frame(width: 58, height: 84)
                        .shadow(color: .black.opacity(0.3), radius: 9, y: 5)

                    body(showsTitle: true)
                }
            } else {
                body(showsTitle: true)
            }

            if !item.photos.isEmpty {
                PhotoStrip(photos: item.photos, accent: item.accent, height: 74)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.white.opacity(0.03), item.accent.color.opacity(0.06)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: PrismGlassMetrics.cardCorner, style: .continuous)
                        .stroke(item.accent.color.opacity(0.17), lineWidth: 1)
                }
        }
        .glassEffect(.regular, in: .rect(cornerRadius: PrismGlassMetrics.cardCorner))
        // Entries settle in as they arrive, the way the web reveals them on
        // scroll. Skipped entirely under Reduce Motion.
        .opacity(shown ? 1 : 0.42)
        .offset(y: shown ? 0 : 14)
        .onAppear {
            if reduceMotion {
                shown = true
            } else {
                withAnimation(.spring(response: 0.62, dampingFraction: 0.86)) { shown = true }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(item.categoryLabel)
                .font(.prismMicro)
                .foregroundStyle(item.accent.color)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background { Capsule().fill(item.accent.color.opacity(0.14)) }

            if !item.status.isEmpty {
                Text(item.status)
                    .font(.prismMicro)
                    .prismMuted()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .overlay { Capsule().stroke(PrismColor.hairline, lineWidth: 1) }
            }

            Spacer(minLength: 0)

            Text(item.date, format: .dateTime.hour().minute())
                .font(.prismMicro)
                .monospacedDigit()
                .prismMuted()
        }
    }

    @ViewBuilder
    private func body(showsTitle: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if showsTitle {
                Text(item.title)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if item.progress != nil {
                progressBlock
            } else if !item.gameSessionMinutes.isEmpty {
                GameSessionDonuts(minutes: item.gameSessionMinutes, accent: item.accent)
            }

            if !item.snippet.isEmpty {
                Text(item.snippet)
                    .font(.prismCaption)
                    .prismMuted()
                    .lineLimit(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var progressBlock: some View {
        let value = item.progress ?? 0

        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Spacer(minLength: 0)

                if value >= 100 {
                    Text("완독")
                        .font(.prismMicro)
                        .prismMuted()
                }

                if item.progressDelta > 0 {
                    Text("+\(item.progressDelta)%")
                        .font(PrismFont.numeral(14, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(PrismColor.text.opacity(0.9))
                }

                Text("\(value)%")
                    .font(PrismFont.numeral(13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(item.accent.color)
            }

            TimelineProgressBar(
                value: value,
                start: item.progressStart,
                accent: item.accent
            )

            HStack(spacing: 8) {
                if !item.deltaLabel.isEmpty {
                    Text(item.deltaLabel)
                        .font(.prismMicro)
                        .monospacedDigit()
                        .foregroundStyle(PrismColor.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background { Capsule().fill(item.accent.color.opacity(0.1)) }
                        .overlay { Capsule().stroke(item.accent.color.opacity(0.14), lineWidth: 1) }
                }

                Spacer(minLength: 0)

                Text(item.summary)
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }
        }
    }
}

/// Progress bar that shows *where the day started* as well as where it ended —
/// the gain is a brighter band sitting on top of the existing fill, so a big
/// day is visible without reading the number.
struct TimelineProgressBar: View {
    let value: Int
    let start: Int
    let accent: PrismAccent
    var height: CGFloat = 14

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        let clamped = min(max(value, 0), 100)
        let clampedStart = min(max(start, 0), clamped)
        let delta = clamped - clampedStart

        GeometryReader { proxy in
            let width = proxy.size.width

            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [accent.color.opacity(0.45), accent.color.opacity(0.85)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: width * fraction(clamped))
                    .shadow(color: accent.color.opacity(0.2), radius: 8)

                if delta > 0 {
                    Capsule()
                        .fill(accent.tone.light)
                        .frame(width: width * fraction(delta))
                        .shadow(color: accent.tone.light.opacity(0.33), radius: 11)
                        .offset(x: width * (shown ? Double(clampedStart) / 100 : 0))
                }
            }
        }
        .frame(height: height)
        .onAppear {
            if reduceMotion {
                shown = true
            } else {
                withAnimation(.spring(response: 0.8, dampingFraction: 0.88).delay(0.12)) { shown = true }
            }
        }
        .accessibilityHidden(true)
    }

    private func fraction(_ percent: Int) -> Double {
        shown ? Double(percent) / 100 : 0
    }
}

/// One donut per play session, mirroring the web's conic gradients. The ring
/// fills relative to the longest session of the day, so a marathon reads
/// differently from a quick round.
struct GameSessionDonuts: View {
    let minutes: [Int]
    let accent: PrismAccent

    private var longest: Int { max(minutes.max() ?? 0, 1) }

    private var totalLabel: String {
        let total = minutes.reduce(0, +)
        let hours = total / 60
        let rest = total % 60
        if hours > 0, rest > 0 { return "\(hours)시간 \(rest)분" }
        if hours > 0 { return "\(hours)시간" }
        return "\(rest)분"
    }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(Array(minutes.enumerated()), id: \.offset) { _, value in
                    Circle()
                        .trim(from: 0, to: Double(value) / Double(longest))
                        .stroke(accent.color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .background {
                            Circle().stroke(Color.white.opacity(0.1), lineWidth: 4)
                        }
                        .frame(width: 14, height: 14)
                }
            }

            Text(totalLabel)
                .font(.prismMicro)
                .monospacedDigit()
                .prismMuted()

            Spacer(minLength: 0)
        }
    }
}

// MARK: - Calendar

/// The last three months with a record, days that have entries lit up.
struct TimelineCalendar: View {
    let days: [TimelineDay]

    private struct Month: Identifiable {
        let id: String
        let label: String
        /// `nil` cells pad the grid before the first weekday and after the last.
        let cells: [Cell?]
    }

    private struct Cell {
        let day: Int
        let count: Int
    }

    var body: some View {
        PrismGlassSection {
            VStack(spacing: 14) {
                ForEach(months) { month in
                    monthCard(month)
                }
            }
        }
    }

    private func monthCard(_ month: Month) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(month.label)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                Text("기록일 강조")
                    .font(.prismMicro)
                    .prismMuted()
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                ForEach(["월", "화", "수", "목", "금", "토", "일"], id: \.self) { label in
                    Text(label)
                        .font(.prismMicro)
                        .prismMuted()
                }

                ForEach(Array(month.cells.enumerated()), id: \.offset) { _, cell in
                    cellView(cell)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    @ViewBuilder
    private func cellView(_ cell: Cell?) -> some View {
        if let cell {
            let active = cell.count > 0

            VStack(alignment: .leading, spacing: 4) {
                Text("\(cell.day)")
                    .font(.prismCaption)
                    .monospacedDigit()
                    .foregroundStyle(active ? PrismColor.text : PrismColor.textMuted)

                Spacer(minLength: 0)

                if active {
                    Text("\(cell.count)개")
                        .font(.prismMicro)
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.reading.color)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .topLeading)
            .padding(7)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        active
                            ? AnyShapeStyle(LinearGradient(
                                colors: [
                                    PrismAccent.reading.color.opacity(0.15),
                                    Color.white.opacity(0.03),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            ))
                            : AnyShapeStyle(Color.white.opacity(0.02))
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        active ? PrismAccent.reading.color.opacity(0.28) : PrismColor.hairline,
                        lineWidth: 1
                    )
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(active ? "\(cell.day)일, 기록 \(cell.count)개" : "\(cell.day)일")
        } else {
            Color.clear.frame(minHeight: 54)
        }
    }

    private var months: [Month] {
        let calendar = Calendar.current

        var counts: [String: Int] = [:]
        for day in days {
            for item in day.items {
                counts[key(item.date, calendar), default: 0] += 1
            }
        }

        let monthKeys = Set(days.map { monthKey($0.date, calendar) })
            .sorted(by: >)
            .prefix(3)

        return monthKeys.compactMap { monthKey -> Month? in
            let parts = monthKey.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2,
                  let first = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)),
                  let range = calendar.range(of: .day, in: .month, for: first)
            else { return nil }

            // Monday-first, matching the web's header row.
            let leading = (calendar.component(.weekday, from: first) + 5) % 7
            var cells: [Cell?] = Array(repeating: nil, count: leading)

            for day in range {
                let dayKey = String(format: "%04d-%02d-%02d", parts[0], parts[1], day)
                cells.append(Cell(day: day, count: counts[dayKey] ?? 0))
            }
            while cells.count % 7 != 0 { cells.append(nil) }

            return Month(id: monthKey, label: "\(parts[0])년 \(parts[1])월", cells: cells)
        }
    }

    private func key(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    private func monthKey(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month], from: date)
        return String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
    }
}

#Preview {
    TimelineScreen()
        .environment(PrismStore.preview())
}
