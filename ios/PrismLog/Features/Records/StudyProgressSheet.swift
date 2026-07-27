import PhotosUI
import SwiftUI
import UIKit

/// Logs one study session against a subject.
///
/// Ported from `StudyProgressModal` (`recordsPage.jsx:3724`): one number, and
/// whatever you photographed. The number means pages for page-based subjects
/// and completed chapters for chapter-based ones — the subject decides, so
/// there is no mode switch to get wrong.
struct StudyProgressSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var input: String
    @State private var picked: [PhotosPickerItem] = []
    @State private var pendingPhotos: [Data] = []
    @State private var loadingPhotos = false
    @State private var saving = false

    private let isPageMode: Bool
    private let total: Int

    init(record: RecordItem) {
        self.record = record

        let pagesTotal = record.payload.int("pages_total") ?? record.payload.int("pages") ?? 0
        let pageMode = (record.payload.string("progress_mode") ?? "page") == "page" && pagesTotal > 0

        self.isPageMode = pageMode
        self.total = pageMode ? pagesTotal : StudyGrouping.chapterCount(record.payload)

        let current = pageMode
            ? record.pagesRead
            : (record.payload.array("completed") ?? []).filter { $0.boolValue == true }.count
        _input = State(initialValue: current > 0 ? String(current) : "")
    }

    private var value: Int { Int(input) ?? 0 }

    private var projectedProgress: Int {
        guard total > 0 else { return 0 }
        return min(max(Int((Double(value) / Double(total) * 100).rounded()), 0), 100)
    }

    private var isValid: Bool { !input.isEmpty && value >= 0 && (total == 0 || value <= total) }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .study)

                ScrollView {
                    VStack(spacing: 16) {
                        preview
                        valueField
                        photoField
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("공부 기록 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(!isValid || saving)
                        .accessibilityIdentifier("study.progress.save")
                }
            }
        }
    }

    private var preview: some View {
        HStack(spacing: 14) {
            CoverImage(url: record.coverURL, accent: .study, cornerRadius: 12)
                .frame(width: 66, height: 96)

            VStack(alignment: .leading, spacing: 6) {
                Text(record.entityTitle ?? record.title)
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
                        .foregroundStyle(PrismAccent.study.color)
                        .contentTransition(.numericText())
                }
                .animation(PrismMotion.snappy, value: projectedProgress)

                ProgressMeter(value: Double(projectedProgress) / 100, accent: .study)
                    .id(projectedProgress)
            }

            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private var valueField: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(isPageMode ? "현재 공부한 페이지" : "완료한 챕터 수")
                .font(.prismCallout)
                .prismMuted()

            HStack {
                TextField(
                    isPageMode ? "몇 페이지까지 공부했나요?" : "몇 개 챕터를 완료했나요?",
                    text: $input
                )
                .keyboardType(.numberPad)
                .font(PrismFont.numeral(22, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
                .accessibilityIdentifier("study.progress.value")

                Text(isPageMode ? "p." : "개")
                    .font(.prismCallout)
                    .prismMuted()
            }

            if total > 0 {
                Text("전체 \(total)\(isPageMode ? "p" : "개")")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }

            if !input.isEmpty, total > 0, value > total {
                Text("전체 \(total)\(isPageMode ? "쪽" : "개")를 넘을 수 없습니다.")
                    .font(.prismMicro)
                    .foregroundStyle(PrismAccent.movie.color)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
                .tint(PrismAccent.study.color)
            }

            if loadingPhotos {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("사진 준비 중…").font(.prismCaption).prismMuted()
                }
            } else if pendingPhotos.isEmpty {
                Text("필기나 정리한 내용을 남겨 보세요. 저장할 때 함께 올라갑니다.")
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
        loadingPhotos = true
        defer { loadingPhotos = false; picked = [] }

        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let compressed = ImageCompressor.jpeg(from: data) else { continue }
            pendingPhotos.append(compressed)
        }
    }

    private func save() async {
        guard isValid else { return }
        saving = true
        defer { saving = false }

        let uploaded = pendingPhotos.isEmpty ? [] : await store.uploadPhotos(pendingPhotos)

        await store.addStudyActivity(
            to: record,
            value: isPageMode ? .pages(value) : .chapters(value),
            photoPaths: uploaded
        )

        PrismHaptics.saved()
        dismiss()
    }
}
