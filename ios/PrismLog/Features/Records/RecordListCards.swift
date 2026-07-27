import SwiftUI

// MARK: - Shell

/// The horizontal card every record list uses: cover on the left, a column of
/// facts on the right. Ported from `FeatureCardShell`
/// (`src/features/prismlog/pages/recordsPage.jsx:636`).
struct FeatureCard<Content: View>: View {
    let accent: PrismAccent
    let coverURL: URL?
    @ViewBuilder var content: Content

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            CoverImage(url: coverURL, accent: accent, cornerRadius: 18)
                .frame(width: 96, height: 144)
                .shadow(color: .black.opacity(0.2), radius: 18, y: 12)

            VStack(alignment: .leading, spacing: 10) {
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: accent.color)
    }
}

// MARK: - Card parts

/// The stat line the web sets in Outfit: an oversized figure with a small
/// accent-colored suffix riding its baseline.
struct BigStat: View {
    let value: String
    let suffix: String
    let accent: PrismAccent
    var size: CGFloat = 28

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 1) {
            Text(value)
                .font(PrismFont.numeral(size, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)

            Text(suffix)
                .font(PrismFont.numeral(size * 0.5, weight: .bold))
                .foregroundStyle(accent.color)
        }
    }
}

struct CardEyebrow: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.prismMicro)
            .tracking(0.6)
            .textCase(.uppercase)
            .prismMuted()
    }
}

struct TagChips: View {
    let tags: [String]
    let accent: PrismAccent

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                Text("#\(tag)")
                    .font(.prismMicro)
                    .foregroundStyle(accent.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background { Capsule().fill(accent.color.opacity(0.12)) }
                    .overlay { Capsule().stroke(accent.color.opacity(0.24), lineWidth: 1) }
            }
        }
    }
}

struct StatusPill: View {
    let text: String
    let accent: PrismAccent

    var body: some View {
        Text(text)
            .font(.prismMicro)
            .foregroundStyle(accent.color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background { Capsule().fill(accent.color.opacity(0.14)) }
            .overlay { Capsule().stroke(accent.color.opacity(0.3), lineWidth: 1) }
    }
}

/// Card actions sit inside a `NavigationLink`'s label, so they have to claim
/// their own hit area — `.buttonStyle(.plain)` alone would let the tap fall
/// through to the link and open the detail instead.
struct CardActionButton: View {
    let title: String
    let accent: PrismAccent
    var filled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.prismCaption)
                .foregroundStyle(filled ? PrismColor.background : accent.color)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(filled ? accent.color : accent.color.opacity(0.14))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(accent.color.opacity(filled ? 0 : 0.35), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
    }
}

struct CardEditButton: View {
    let accent: PrismAccent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "square.and.pencil")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(accent.color)
                .frame(width: 32, height: 32)
                .background { Circle().fill(accent.color.opacity(0.12)) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("편집")
    }
}

// MARK: - Reading

struct ReadingListCard: View {
    let book: RecordItem
    let onEdit: () -> Void
    let onLogProgress: () -> Void

    var body: some View {
        FeatureCard(accent: .reading, coverURL: book.coverURL) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(book.title)
                        .font(.prismTitle)
                        .foregroundStyle(PrismColor.text)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                    if let author = book.author, !author.isEmpty {
                        Text(author)
                            .font(.prismCaption)
                            .prismMuted()
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                CardEditButton(accent: .reading, action: onEdit)
            }

            HStack(spacing: 8) {
                CardEyebrow(text: "독서 진행률")
                if book.rating > 0 {
                    RatingStars(rating: book.rating, accent: .reading, size: 12)
                }
                Spacer(minLength: 0)
            }

            HStack(alignment: .lastTextBaseline) {
                BigStat(value: "\(book.progress)", suffix: "%", accent: .reading)
                Spacer(minLength: 0)
                if book.pagesTotal > 0 {
                    Text("\(book.pagesRead)/\(book.pagesTotal)p")
                        .font(.prismCaption)
                        .monospacedDigit()
                        .prismMuted()
                }
            }

            ProgressMeter(value: Double(book.progress) / 100, accent: .reading)

            if !book.review.isEmpty {
                Text("\"\(book.review)\"")
                    .font(.prismCaption)
                    .italic()
                    .prismMuted()
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(alignment: .bottom, spacing: 10) {
                TagChips(tags: book.tags, accent: .reading)
                Spacer(minLength: 0)
                CardActionButton(title: "+ 기록", accent: .reading, action: onLogProgress)
            }
        }
    }
}

// MARK: - Study

struct StudyListCard: View {
    let group: StudyGroup
    let onEdit: () -> Void

    private var record: RecordItem { group.latest }

    var body: some View {
        FeatureCard(accent: .study, coverURL: group.coverURL) {
            HStack(alignment: .top, spacing: 12) {
                StatusPill(text: "공부 중", accent: .study)
                Spacer(minLength: 0)
                CardEditButton(accent: .study, action: onEdit)
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(group.title)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                scale
            }

            HStack(alignment: .lastTextBaseline) {
                CardEyebrow(text: "Study Progress")
                Spacer(minLength: 0)
                BigStat(value: "\(group.progress)", suffix: "%", accent: .study)
            }

            ProgressMeter(value: Double(group.progress) / 100, accent: .study)

            // No "+ 기록" here, unlike the web: adding a study activity means
            // creating a second log against the same entity, which this app
            // has no write path for yet. Tracked as a follow-up rather than
            // faked with a button that opens the edit sheet.
            HStack(alignment: .bottom, spacing: 10) {
                TagChips(tags: group.tags, accent: .study)
                Spacer(minLength: 0)
                Text("\(group.activityCount)회 기록")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }
        }
    }

    /// Page-based subjects show pages; chapter-based ones show how many
    /// top-level chapters the table of contents holds.
    @ViewBuilder
    private var scale: some View {
        let mode = record.payload.string("progress_mode") ?? "page"

        if mode == "page", record.pagesTotal > 0 {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(record.pagesRead)")
                    .font(PrismFont.numeral(28, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)

                Text("/ \(record.pagesTotal)p")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }
        } else {
            Text("\(record.payload.array("toc")?.count ?? 0)개 챕터")
                .font(.prismCallout)
                .foregroundStyle(PrismColor.text)
        }
    }
}

// MARK: - Culture

struct CultureListCard: View {
    let record: RecordItem
    let onEdit: () -> Void
    /// Games log playtime from the list, the way reading logs progress. Movies
    /// and series have nothing to add without opening the detail.
    var onLogSession: (() -> Void)?

    private var accent: PrismAccent { record.accent }

    var body: some View {
        FeatureCard(accent: accent, coverURL: record.coverURL) {
            HStack(alignment: .top, spacing: 12) {
                if let status = record.status, !status.isEmpty {
                    StatusPill(text: status, accent: accent)
                }
                Spacer(minLength: 0)
                CardEditButton(accent: accent, action: onEdit)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(record.title)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 8) {
                    if record.cultureType == .series, let platform = record.platformLabel, !platform.isEmpty {
                        CardEyebrow(text: platform)
                    } else {
                        CardEyebrow(text: record.categoryLabel)
                    }

                    if record.rating > 0 {
                        RatingStars(rating: record.rating, accent: accent, size: 12)
                    }

                    Spacer(minLength: 0)
                }
            }

            if let progress = record.seriesProgress, progress.totalEpisodes > 0 {
                seriesSummary(progress)
            } else {
                HStack(alignment: .lastTextBaseline) {
                    Text(playtimeLabel)
                        .font(.prismCaption)
                        .prismMuted()

                    Spacer(minLength: 0)

                    Text(record.status ?? "미설정")
                        .font(PrismFont.numeral(16, weight: .bold))
                        .foregroundStyle(accent.color)
                }
            }

            HStack(alignment: .bottom, spacing: 10) {
                TagChips(tags: record.tags, accent: accent)
                Spacer(minLength: 0)
                if let onLogSession {
                    CardActionButton(title: "+ 기록", accent: accent, action: onLogSession)
                }
            }
        }
    }

    private func seriesSummary(_ progress: SeriesProgress) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    CardEyebrow(
                        text: progress.seasons.isEmpty
                            ? "시리즈 진행률"
                            : "\(progress.seasons.count)시즌"
                    )
                    Text(progress.playtimeLabel)
                        .font(.prismCallout)
                        .foregroundStyle(PrismColor.text)
                }

                Spacer(minLength: 0)

                BigStat(value: "\(progress.progress)", suffix: "%", accent: accent)
            }

            ProgressMeter(value: Double(progress.progress) / 100, accent: accent)
        }
    }

    private var playtimeLabel: String {
        if let playtime = record.payload.string("playtime"), !playtime.isEmpty {
            return playtime
        }
        let minutes = record.totalGameMinutes
        guard minutes > 0 else { return "기록 대기" }
        return minutes >= 60
            ? "\(minutes / 60)시간 \(String(format: "%02d", minutes % 60))분"
            : "\(minutes)분"
    }
}
