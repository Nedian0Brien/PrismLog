import SwiftUI

/// Reading session mode (spec §6.6): a timer beside the book while reading,
/// then the usual progress sheet to save it.
///
/// Built on `ArrangementView` split at the fold on either axis: in tabletop
/// the cover and clock stand on the upper half and the controls lie on the
/// lower half; in book posture they sit side by side. Spec §6.6 first limited
/// the split to the vertical axis, which in book posture dropped the controls
/// entirely (iOS 27.2 iPhone Duo simulator, Phase 7). Every posture keeps the
/// same controls and order — Apple's guidance is not to drop features by
/// posture.
struct ReadingSessionScreen: View {
    let record: RecordItem

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(AppNavigationModel.self) private var navigation

    @State private var finishing: ReadingProgressSheet.SessionDraft?
    /// The hinge is part-way open — tabletop or book. Only dresses the
    /// clock; layout comes from `ArrangementView` (spec §7.3).
    @State private var isPartlyOpen = false

    /// The session lives in the navigation model, not in this view, so a
    /// fold or a rotation that rebuilds the screen keeps the clock running
    /// and what's been typed (spec §7.4).
    private var session: ReadingSessionState {
        if let current = navigation.readingSession, current.recordID == record.id { return current }
        return ReadingSessionState(
            recordID: record.id,
            startedAt: .now,
            currentPage: record.pagesRead > 0 ? String(record.pagesRead) : "",
            note: ""
        )
    }

    private var startedAt: Date { session.startedAt }

    private var currentPage: Binding<String> {
        Binding(
            get: { session.currentPage },
            set: { navigation.readingSession?.currentPage = $0 }
        )
    }

    private var note: Binding<String> {
        Binding(
            get: { session.note },
            set: { navigation.readingSession?.note = $0 }
        )
    }

    var body: some View {
        ArrangementView {
            stage
        } secondary: {
            controls
        }
        .arrangementViewStyle(.split)
        .prismWallBackground()
        .onAppear {
            // Start a session, or pick up the one already running for this book.
            if navigation.readingSession?.recordID != record.id {
                navigation.readingSession = session
            }
        }
        .onHingeChange { _, newContext in
            let partlyOpen = newContext.hinge?.status == .partiallyOpen
            withAnimation(reduceMotion ? nil : PrismMotion.screen) { isPartlyOpen = partlyOpen }
        }
        .sheet(item: $finishing) { draft in
            ReadingProgressSheet(record: record, session: draft) {
                navigation.readingSession = nil
                dismiss()
            }
        }
    }

    // MARK: Primary: the book and the clock

    private var stage: some View {
        VStack(spacing: 18) {
            CoverImage(url: record.coverURL, accent: .reading, title: record.title, cornerRadius: 14)
                .frame(width: isPartlyOpen ? 96 : 120, height: isPartlyOpen ? 144 : 180)
                .shadow(color: .black.opacity(0.35), radius: 18, y: 10)

            Text(record.title)
                .font(.prismTitle)
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            TimelineView(.periodic(from: startedAt, by: 1)) { context in
                Text(Self.elapsedLabel(from: startedAt, to: context.date))
                    .font(PrismFont.numeral(isPartlyOpen ? 56 : 44, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)
                    .contentTransition(.numericText())
            }
            .accessibilityLabel("읽은 시간")
            .accessibilityIdentifier("session.elapsed")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Secondary: what to save

    private var controls: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("지금 쪽수")
                        .font(.prismCaption)
                        .foregroundStyle(PrismColor.text)
                    HStack {
                        TextField("쪽", text: currentPage)
                            .keyboardType(.numberPad)
                            .font(PrismFont.numeral(22))
                            .foregroundStyle(PrismColor.text)
                            .accessibilityIdentifier("session.page")
                        if record.pagesTotal > 0 {
                            Text("/ \(record.pagesTotal)쪽")
                                .font(.prismCallout)
                                .foregroundStyle(PrismColor.text)
                        }
                    }
                }
                .prismGlassCard()

                VStack(alignment: .leading, spacing: 8) {
                    Text("메모")
                        .font(.prismCaption)
                        .foregroundStyle(PrismColor.text)
                    TextField("남기고 싶은 문장이나 생각", text: note, axis: .vertical)
                        .lineLimit(3...6)
                        .font(.prismBody)
                        .foregroundStyle(PrismColor.text)
                }
                .prismGlassCard()

                HStack(spacing: 12) {
                    Button("그만두기", systemImage: "xmark") {
                        navigation.readingSession = nil
                        dismiss()
                    }
                        .buttonStyle(.glass)
                        .accessibilityIdentifier("session.cancel")

                    Button("읽기 끝내기", systemImage: "checkmark") { finish() }
                        .buttonStyle(.glassProminent)
                        .tint(PrismAccent.reading.color)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .accessibilityIdentifier("session.finish")
                }
                .font(.prismHeadline)
            }
            .padding(18)
        }
        .scrollIndicators(.hidden)
    }

    private func finish() {
        finishing = ReadingProgressSheet.SessionDraft(
            startedAt: startedAt,
            endedAt: .now,
            currentPage: Int(session.currentPage),
            note: session.note
        )
    }

    /// "12:07" under an hour, "1:02:07" past it.
    static func elapsedLabel(from start: Date, to now: Date) -> String {
        let seconds = max(0, Int(now.timeIntervalSince(start)))
        let hours = seconds / 3_600
        let minutes = (seconds % 3_600) / 60
        let remainder = seconds % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, remainder)
            : String(format: "%02d:%02d", minutes, remainder)
    }
}
