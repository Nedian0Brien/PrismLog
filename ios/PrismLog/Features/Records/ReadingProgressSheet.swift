import SwiftUI

/// Log today's reading: where you got to, and anything worth keeping.
struct ReadingProgressSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var currentPage: String
    @State private var totalPages: String
    @State private var note = ""
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        _currentPage = State(initialValue: String(record.pagesRead))
        _totalPages = State(initialValue: String(max(record.pagesTotal, 0)))
    }

    private var resolvedTotal: Int { Int(totalPages) ?? 0 }
    private var resolvedCurrent: Int { Int(currentPage) ?? 0 }

    private var projectedProgress: Int {
        guard resolvedTotal > 0 else { return 0 }
        return min(max(Int((Double(resolvedCurrent) / Double(resolvedTotal) * 100).rounded()), 0), 100)
    }

    private var isValid: Bool {
        resolvedTotal > 0 && resolvedCurrent >= 0 && resolvedCurrent <= resolvedTotal
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .reading)

                ScrollView {
                    VStack(spacing: 16) {
                        preview
                        pageFields
                        noteField
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("진도 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(!isValid || saving)
                }
            }
        }
    }

    private var preview: some View {
        HStack(spacing: 14) {
            ProgressWaterCover(
                url: record.coverURL,
                progress: projectedProgress,
                accent: .reading,
                width: 78
            )
            .id(projectedProgress) // re-animate the fill as the number changes

            VStack(alignment: .leading, spacing: 6) {
                Text(record.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(2)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(record.progress)%")
                        .font(.prismCallout)
                        .prismMuted()
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .bold))
                        .prismMuted()
                    Text("\(projectedProgress)%")
                        .font(PrismFont.numeral(20, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.reading.color)
                        .contentTransition(.numericText())
                }
                .animation(PrismMotion.snappy, value: projectedProgress)
            }

            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: PrismAccent.reading.color)
    }

    private var pageFields: some View {
        VStack(spacing: 12) {
            numberField("현재 쪽", text: $currentPage)
            Divider().overlay(PrismColor.hairline)
            numberField("전체 쪽", text: $totalPages)

            if !isValid {
                Text(resolvedTotal <= 0
                     ? "전체 쪽수를 입력해 주세요."
                     : "현재 쪽수는 전체 쪽수를 넘을 수 없습니다.")
                    .font(.prismMicro)
                    .foregroundStyle(PrismAccent.movie.color)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .prismGlassCard()
    }

    private func numberField(_ label: String, text: Binding<String>) -> some View {
        HStack {
            Text(label)
                .font(.prismCallout)
                .prismMuted()

            Spacer(minLength: 0)

            TextField("0", text: text)
                .keyboardType(.numberPad)
                .font(PrismFont.numeral(19, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.trailing)
                .frame(width: 110)
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("메모 · 필사")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            TextField("기억하고 싶은 문장이나 생각…", text: $note, axis: .vertical)
                .lineLimit(3...8)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func save() async {
        guard isValid else { return }
        saving = true
        defer { saving = false }

        await store.addReadingProgress(
            to: record.id,
            currentPage: resolvedCurrent,
            totalPages: resolvedTotal,
            note: note
        )

        PrismHaptics.saved()
        dismiss()
    }
}
