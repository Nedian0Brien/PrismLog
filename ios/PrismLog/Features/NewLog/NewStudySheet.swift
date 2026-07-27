import SwiftUI

/// Start a study record. Unlike books and films there is nothing to search —
/// the subject is whatever the user is working through — so this is a plain
/// form with an optional table of contents.
struct NewStudySheet: View {
    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var goal = ""
    @State private var retrospect = ""
    @State private var progressMode = "page"
    @State private var pagesTotal = ""
    @State private var pagesRead = ""
    @State private var tocText = ""
    @State private var tagInput = ""
    @State private var saving = false

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .study)

                ScrollView {
                    VStack(spacing: 16) {
                        basicsCard
                        progressCard
                        tocCard
                        reflectionCard
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("새 공부")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(!isValid || saving)
                        .accessibilityIdentifier("study.save")
                }
            }
        }
    }

    private var basicsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            field("제목", text: $title, placeholder: "교재 또는 공부 주제")
            Divider().overlay(PrismColor.hairline)
            field("학습 목표", text: $goal, placeholder: "예: 주 3회, 매일 1시간")
            Divider().overlay(PrismColor.hairline)
            field("태그", text: $tagInput, placeholder: "#코딩 #AI")
        }
        .prismGlassCard()
    }

    private var progressCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("진행 방식")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Picker("진행 방식", selection: $progressMode) {
                Text("페이지").tag("page")
                Text("목차").tag("chapter")
            }
            .pickerStyle(.segmented)

            if progressMode == "page" {
                HStack {
                    Text("진행 / 전체").font(.prismCallout).prismMuted()
                    Spacer(minLength: 0)
                    TextField("0", text: $pagesRead)
                        .keyboardType(.numberPad)
                        .frame(width: 60)
                        .multilineTextAlignment(.trailing)
                    Text("/").prismMuted()
                    TextField("0", text: $pagesTotal)
                        .keyboardType(.numberPad)
                        .frame(width: 60)
                        .multilineTextAlignment(.trailing)
                }
                .font(PrismFont.numeral(17, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
            } else {
                Text("아래 목차의 완료 개수로 진행률을 계산합니다.")
                    .font(.prismCaption)
                    .prismMuted()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var tocCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("목차")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Text("한 줄에 하나씩 적으면 체크할 수 있는 항목이 됩니다.")
                .font(.prismCaption)
                .prismMuted()

            TextField("1장. 서론\n2장. 기본 문법", text: $tocText, axis: .vertical)
                .lineLimit(4...12)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var reflectionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("오늘의 회고")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            TextField("오늘 배운 핵심 내용 요약…", text: $retrospect, axis: .vertical)
                .lineLimit(3...8)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.prismCaption).prismMuted()
            TextField(placeholder, text: text)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save() async {
        saving = true
        defer { saving = false }

        await store.createStudyRecord(draft: StudyDraft(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            goal: goal.trimmingCharacters(in: .whitespacesAndNewlines),
            retrospect: retrospect.trimmingCharacters(in: .whitespacesAndNewlines),
            progressMode: progressMode,
            pagesTotal: Int(pagesTotal) ?? 0,
            pagesRead: Int(pagesRead) ?? 0,
            tocTitles: tocText
                .split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { !$0.isEmpty },
            tags: parseTagInput(tagInput)
        ))

        PrismHaptics.saved()
        dismiss()
    }
}
