import SwiftUI

/// Edit or delete a 문화 record. Status vocabulary depends on the type, the way
/// `getCultureStatusOptions` splits it.
struct CultureEditSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var status: String
    @State private var rating: Int
    @State private var platform: String
    @State private var tagInput: String
    @State private var confirmingDelete = false
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        let type = record.cultureType ?? .movie
        _title = State(initialValue: record.title)
        _status = State(initialValue: record.status ?? CultureStatus.default(for: type))
        _rating = State(initialValue: record.rating)
        _platform = State(initialValue: record.platformLabel ?? "")
        _tagInput = State(initialValue: record.tags.map { "#\($0)" }.joined(separator: " "))
    }

    var body: some View {
        EditSheetScaffold(
            title: "기록 편집",
            accent: record.accent,
            canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty && !saving,
            onSave: { await save() },
            onDelete: { confirmingDelete = true },
            confirmingDelete: $confirmingDelete,
            performDelete: { await delete() }
        ) {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    EditField(label: "제목", text: $title, placeholder: "제목")
                    Divider().overlay(PrismColor.hairline)
                    EditField(label: "플랫폼", text: $platform, placeholder: "예: 넷플릭스")
                    Divider().overlay(PrismColor.hairline)
                    EditField(label: "태그", text: $tagInput, placeholder: "#SF #드라마")
                }
                .prismGlassCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("상태").font(.prismHeadline).foregroundStyle(PrismColor.text)

                    Picker("상태", selection: $status) {
                        ForEach(CultureStatus.options(for: record.cultureType ?? .movie), id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(record.accent.color)

                    Divider().overlay(PrismColor.hairline)

                    HStack {
                        Text("별점").font(.prismCallout).prismMuted()
                        Spacer(minLength: 0)
                        StarRatingPicker(rating: $rating, accent: record.accent)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .prismGlassCard()
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }

        await store.updateCultureMeta(
            id: record.id,
            title: title,
            status: status,
            rating: rating,
            platformLabel: platform.trimmingCharacters(in: .whitespacesAndNewlines),
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

/// Edit or delete a 공부 record.
struct StudyEditSheet: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var goal: String
    @State private var retrospect: String
    @State private var tagInput: String
    @State private var confirmingDelete = false
    @State private var saving = false

    init(record: RecordItem) {
        self.record = record
        _title = State(initialValue: record.title)
        _goal = State(initialValue: record.payload.string("goal") ?? "")
        _retrospect = State(initialValue: record.payload.string("retrospect") ?? "")
        _tagInput = State(initialValue: record.tags.map { "#\($0)" }.joined(separator: " "))
    }

    var body: some View {
        EditSheetScaffold(
            title: "기록 편집",
            accent: .study,
            canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty && !saving,
            onSave: { await save() },
            onDelete: { confirmingDelete = true },
            confirmingDelete: $confirmingDelete,
            performDelete: { await delete() }
        ) {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    EditField(label: "제목", text: $title, placeholder: "교재 또는 주제")
                    Divider().overlay(PrismColor.hairline)
                    EditField(label: "태그", text: $tagInput, placeholder: "#코딩 #AI")
                }
                .prismGlassCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("학습 목표").font(.prismHeadline).foregroundStyle(PrismColor.text)
                    TextField("예: 주 3회, 매일 1시간", text: $goal, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.prismBody)
                        .foregroundStyle(PrismColor.text)

                    Divider().overlay(PrismColor.hairline)

                    Text("회고").font(.prismHeadline).foregroundStyle(PrismColor.text)
                    TextField("오늘 배운 핵심 내용…", text: $retrospect, axis: .vertical)
                        .lineLimit(3...8)
                        .font(.prismBody)
                        .foregroundStyle(PrismColor.text)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .prismGlassCard()
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }

        await store.updateRecord(id: record.id) { payload in
            payload["goal"] = .string(goal.trimmingCharacters(in: .whitespacesAndNewlines))
            payload["retrospect"] = .string(retrospect.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        await store.renameRecord(
            id: record.id,
            title: title,
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

// MARK: - Shared chrome

struct EditField: View {
    let label: String
    @Binding var text: String
    let placeholder: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.prismCaption).prismMuted()
            TextField(placeholder, text: $text)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Save / cancel / delete chrome shared by the category edit sheets.
struct EditSheetScaffold<Content: View>: View {
    let title: String
    let accent: PrismAccent
    let canSave: Bool
    let onSave: () async -> Void
    let onDelete: () -> Void
    @Binding var confirmingDelete: Bool
    let performDelete: () async -> Void
    @ViewBuilder var content: Content

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: accent)

                ScrollView {
                    VStack(spacing: 16) {
                        content

                        Button(role: .destructive, action: onDelete) {
                            Text("기록 삭제")
                                .font(.prismCallout)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.glass)
                        .tint(PrismAccent.movie.color)
                        .accessibilityIdentifier("edit.delete")
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await onSave() } }
                        .disabled(!canSave)
                        .accessibilityIdentifier("edit.save")
                }
            }
            .confirmationDialog(
                "이 기록을 삭제할까요?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) { Task { await performDelete() } }
                Button("취소", role: .cancel) {}
            } message: {
                Text("되돌릴 수 없습니다.")
            }
        }
    }
}
