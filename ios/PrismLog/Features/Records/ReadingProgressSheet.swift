import PhotosUI
import SwiftUI
import UIKit

/// Log today's reading: where you got to, and anything worth keeping.
struct ReadingProgressSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var currentPage: String
    @State private var totalPages: String
    @State private var note = ""
    @State private var startedAt: Date
    @State private var endedAt: Date
    @State private var picked: [PhotosPickerItem] = []
    @State private var pendingPhotos: [Data] = []
    @State private var uploading = false
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        _currentPage = State(initialValue: String(record.pagesRead))
        _totalPages = State(initialValue: String(max(record.pagesTotal, 0)))
        let now = Date.now
        _endedAt = State(initialValue: now)
        _startedAt = State(initialValue: now.addingTimeInterval(-30 * 60))
    }

    private var durationMinutes: Int {
        max(0, Int(endedAt.timeIntervalSince(startedAt) / 60))
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
                        timeFields
                        noteField
                        photoField
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

    /// Duration is derived from the two stamps rather than typed, matching the
    /// web — it keeps `duration_minutes` consistent with `started_at`/`ended_at`.
    private var timeFields: some View {
        VStack(spacing: 10) {
            DatePicker("시작", selection: $startedAt, displayedComponents: [.date, .hourAndMinute])
                .font(.prismCallout)
            Divider().overlay(PrismColor.hairline)
            DatePicker("종료", selection: $endedAt, in: startedAt..., displayedComponents: [.date, .hourAndMinute])
                .font(.prismCallout)

            HStack {
                Text("읽은 시간")
                    .font(.prismCaption)
                    .prismMuted()
                Spacer(minLength: 0)
                Text("\(durationMinutes)분")
                    .font(PrismFont.numeral(15, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(PrismAccent.reading.color)
            }
        }
        .tint(PrismAccent.reading.color)
        .prismGlassCard()
    }

    private var photoField: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("사진")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                PhotosPicker(selection: $picked, maxSelectionCount: 6, matching: .images) {
                    Label("추가", systemImage: "photo.badge.plus")
                        .font(.prismCaption)
                }
                .tint(PrismAccent.reading.color)
            }

            if uploading {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("사진 준비 중…").font(.prismCaption).prismMuted()
                }
            } else if pendingPhotos.isEmpty {
                Text("독서 흔적을 남겨 보세요. 저장할 때 함께 업로드됩니다.")
                    .font(.prismCaption)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(Array(pendingPhotos.enumerated()), id: \.offset) { index, data in
                            if let image = UIImage(data: data) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 68, height: 84)
                                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                                    .overlay(alignment: .topTrailing) {
                                        Button {
                                            pendingPhotos.remove(at: index)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 16))
                                                .foregroundStyle(.white, .black.opacity(0.5))
                                        }
                                        .buttonStyle(.plain)
                                        .padding(3)
                                    }
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
        .onChange(of: picked) { _, items in
            Task { await load(items) }
        }
    }

    private func load(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        uploading = true
        defer { uploading = false; picked = [] }

        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let compressed = ImageCompressor.jpeg(from: data) else { continue }
            pendingPhotos.append(compressed)
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

        let uploaded = pendingPhotos.isEmpty ? [] : await store.uploadPhotos(pendingPhotos)

        await store.addReadingProgress(
            to: record.id,
            currentPage: resolvedCurrent,
            totalPages: resolvedTotal,
            note: note,
            startedAt: startedAt,
            endedAt: endedAt,
            photoPaths: uploaded
        )

        PrismHaptics.saved()
        dismiss()
    }
}
