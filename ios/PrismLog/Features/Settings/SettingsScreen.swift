import SwiftUI

struct SettingsScreen: View {
    @Environment(PrismStore.self) private var store

    @State private var editingUserID = false
    @State private var draftUserID = ""
    @State private var backupState: BackupState = .idle

    private enum BackupState: Equatable {
        case idle
        case running
        case done(String)
        case failed(String)
    }

    var body: some View {
        @Bindable var store = store

        return PrismScreenScaffold(eyebrow: "Settings", title: "설정") {
            PrismGlassSection {
                VStack(spacing: 14) {
                    syncCard
                    compositionCard
                    accountCard
                    backupCard
                    aboutCard
                }
            }
        }
        .alert("사용자 ID", isPresented: $editingUserID) {
            TextField("user_id", text: $draftUserID)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("취소", role: .cancel) {}
            Button("변경") {
                let trimmed = draftUserID.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                store.userID = trimmed
                Task { await store.sync() }
            }
        } message: {
            Text("웹과 같은 ID를 쓰면 같은 기록을 봅니다. 이 API는 인증이 없어 ID만으로 구분됩니다.")
        }
    }

    // MARK: - Cards

    private var syncCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("동기화")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                statusChip
            }

            row("마지막 동기화", value: store.lastSyncedAt.map {
                $0.formatted(.dateTime.month().day().hour().minute())
            } ?? "없음")

            row("전송 대기", value: store.pendingChangeCount > 0
                ? "\(store.pendingChangeCount)건"
                : "없음")

            row("저장된 기록", value: "\(store.records.count)건")

            Button {
                Task { await store.sync() }
            } label: {
                Text(store.status == .syncing ? "동기화 중…" : "지금 동기화")
                    .font(.prismCallout)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
            }
            .buttonStyle(.glass)
            .tint(PrismAccent.reading.color)
            .disabled(store.status == .syncing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.reading.color)
    }

    private var statusChip: some View {
        let (label, accent): (String, PrismAccent) = switch store.status {
        case .idle: ("정상", .reading)
        case .syncing: ("동기화 중", .study)
        case .offline: ("오프라인", .study)
        case .failed: ("실패", .movie)
        }

        return Text(label)
            .font(.prismMicro)
            .foregroundStyle(accent.color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background { Capsule().fill(accent.color.opacity(0.16)) }
    }

    /// Mirrors the web's 기록 구성 card, which breaks 문화 down by type — the
    /// dashboard only ever shows it as one bucket.
    private var compositionCard: some View {
        let culture = store.records(in: .culture)

        return VStack(alignment: .leading, spacing: 12) {
            Text("기록 구성")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            compositionRow(.reading, count: store.records(in: .reading).count, unit: "권")
            compositionRow(.study, count: store.records(in: .study).count, unit: "건")

            Divider().overlay(PrismColor.hairline)

            compositionRow(.movie, count: culture.filter { $0.cultureType == .movie }.count, unit: "편")
            compositionRow(.series, count: culture.filter { $0.cultureType == .series }.count, unit: "편")
            compositionRow(.game, count: culture.filter { $0.cultureType == .game }.count, unit: "개")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func compositionRow(_ accent: PrismAccent, count: Int, unit: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: accent.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent.color)
                .frame(width: 20)

            Text(accent.label)
                .font(.prismCallout)
                .foregroundStyle(PrismColor.text)

            Spacer(minLength: 0)

            Text("\(count)\(unit)")
                .font(PrismFont.numeral(15, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(accent.color)
        }
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("계정")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            row("사용자 ID", value: store.userID)

            Button {
                draftUserID = store.userID
                editingUserID = true
            } label: {
                Text("사용자 ID 변경")
                    .font(.prismCallout)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
            }
            .buttonStyle(.glass)
            .accessibilityIdentifier("settings.changeUserID")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var backupCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Google Drive 백업")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Text("현재 기록 전체를 Drive에 JSON으로 저장합니다. 서버에 설정된 계정으로 업로드됩니다.")
                .font(.prismCaption)
                .prismMuted()
                .fixedSize(horizontal: false, vertical: true)

            switch backupState {
            case .done(let name):
                Text("저장됨 · \(name)")
                    .font(.prismMicro)
                    .foregroundStyle(PrismAccent.reading.color)
            case .failed(let message):
                Text(message)
                    .font(.prismMicro)
                    .foregroundStyle(PrismAccent.movie.color)
                    .fixedSize(horizontal: false, vertical: true)
            default:
                EmptyView()
            }

            Button {
                Task { await runBackup() }
            } label: {
                Text(backupState == .running ? "백업 중…" : "백업 만들기")
                    .font(.prismCallout)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
            }
            .buttonStyle(.glass)
            .tint(PrismAccent.study.color)
            .disabled(backupState == .running)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private var aboutCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("PrismLog")
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)

            Text("삶의 색을 기록합니다.")
                .font(.prismCaption)
                .prismMuted()

            row("서버", value: "prism.lawdigest.kr")
            row("버전", value: Bundle.main.shortVersion)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func row(_ label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.prismCaption)
                .prismMuted()
            Spacer(minLength: 12)
            Text(value)
                .font(.prismCaption)
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.trailing)
        }
    }

    private func runBackup() async {
        backupState = .running
        do {
            let result = try await PrismAPIClient.shared.createBackup(userID: store.userID)
            backupState = .done(result.fileName ?? "백업 완료")
            PrismHaptics.saved()
        } catch {
            backupState = .failed(error.localizedDescription)
            PrismHaptics.failed()
        }
    }
}

extension Bundle {
    var shortVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

#Preview {
    SettingsScreen()
        .environment(PrismStore.preview())
}
