import SwiftUI

/// Edit or delete a book. Mirrors `ReadingEditSheet`
/// (`src/features/prismlog/forms/editSheets.jsx`).
struct ReadingEditSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var author: String
    @State private var review: String
    @State private var tagInput: String
    @State private var rating: Int
    @State private var status: ReadingStatus
    @State private var medium: ReadingMedium
    @State private var ebookService: EbookService?
    @State private var confirmingDelete = false
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        _title = State(initialValue: record.title)
        _author = State(initialValue: record.author ?? "")
        _review = State(initialValue: record.review)
        _tagInput = State(initialValue: record.tags.map { "#\($0)" }.joined(separator: " "))
        _rating = State(initialValue: record.rating)
        _status = State(initialValue: record.readingStatus ?? .reading)
        _medium = State(initialValue: record.medium ?? .paper)
        _ebookService = State(initialValue: record.ebookService)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .reading)

                ScrollView {
                    VStack(spacing: 16) {
                        basicsCard
                        mediumCard
                        ratingCard
                        deleteButton
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("기록 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(saving || title.trimmingCharacters(in: .whitespaces).isEmpty)
                        .accessibilityIdentifier("edit.save")
                }
            }
            .confirmationDialog(
                "이 기록을 삭제할까요?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) { Task { await delete() } }
                Button("취소", role: .cancel) {}
            } message: {
                Text("진도·메모·사진이 모두 사라지며 되돌릴 수 없습니다.")
            }
        }
    }

    private var basicsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            labeled("제목", text: $title, placeholder: "책 제목")
            Divider().overlay(PrismColor.hairline)
            labeled("저자", text: $author, placeholder: "저자명")
            Divider().overlay(PrismColor.hairline)
            labeled("한 줄 평", text: $review, placeholder: "이 책을 한 마디로…")
            Divider().overlay(PrismColor.hairline)
            labeled("태그", text: $tagInput, placeholder: "#자기계발 #소설")
        }
        .prismGlassCard()
    }

    private var mediumCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("매체 유형")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Picker("매체 유형", selection: $medium) {
                ForEach(ReadingMedium.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            if medium == .ebook {
                Picker("전자책 서비스", selection: $ebookService) {
                    Text("선택 안 함").tag(EbookService?.none)
                    ForEach(EbookService.allCases) { Text($0.label).tag(EbookService?.some($0)) }
                }
                .pickerStyle(.menu)
                .tint(PrismAccent.reading.color)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var ratingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("상태")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Picker("상태", selection: $status) {
                ForEach(ReadingStatus.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)

            Divider().overlay(PrismColor.hairline)

            HStack {
                Text("별점")
                    .font(.prismCallout)
                    .prismMuted()
                Spacer(minLength: 0)
                StarRatingPicker(rating: $rating, accent: .reading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            confirmingDelete = true
        } label: {
            Text("기록 삭제")
                .font(.prismCallout)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.glass)
        .tint(PrismAccent.movie.color)
        .accessibilityIdentifier("edit.delete")
    }

    private func labeled(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.prismCaption)
                .prismMuted()
            TextField(placeholder, text: text)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() async {
        saving = true
        defer { saving = false }

        await store.updateReadingMeta(
            id: record.id,
            title: title,
            author: author.trimmingCharacters(in: .whitespacesAndNewlines),
            rating: rating,
            review: review.trimmingCharacters(in: .whitespacesAndNewlines),
            status: status,
            medium: medium,
            ebookService: ebookService,
            tags: parseTagInput(tagInput)
        )

        PrismHaptics.saved()
        dismiss()
    }

    private func delete() async {
        await store.deleteRecord(id: record.id)
        PrismHaptics.saved()
        dismiss()
    }
}

/// Add a standalone note without touching progress — the web keeps these
/// separate because a quotation isn't necessarily tied to a reading session.
struct ReadingNoteSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var page: String
    @State private var text = ""
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        _page = State(initialValue: String(record.pagesRead))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .reading)

                ScrollView {
                    VStack(spacing: 16) {
                        HStack {
                            Text("쪽")
                                .font(.prismCallout)
                                .prismMuted()
                            Spacer(minLength: 0)
                            TextField("0", text: $page)
                                .keyboardType(.numberPad)
                                .font(PrismFont.numeral(19, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(PrismColor.text)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 110)
                        }
                        .prismGlassCard()

                        VStack(alignment: .leading, spacing: 8) {
                            Text("메모 · 필사")
                                .font(.prismHeadline)
                                .foregroundStyle(PrismColor.text)

                            TextField("기억하고 싶은 문장이나 생각…", text: $text, axis: .vertical)
                                .lineLimit(5...12)
                                .font(.prismBody)
                                .foregroundStyle(PrismColor.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .prismGlassCard()
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("메모 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(saving || text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }

        await store.addReadingNote(to: record.id, page: Int(page) ?? 0, text: text)
        PrismHaptics.saved()
        dismiss()
    }
}
