import SwiftUI

struct SettingsScreen: View {
    var body: some View {
        PrismScreenScaffold(eyebrow: "Settings", title: "설정") {
            PrismGlassSection {
                PrismPlaceholderCard(
                    accent: .reading,
                    title: "동기화 · 백업",
                    detail: "사용자 ID, 동기화 상태, Google Drive 백업."
                )
            }
        }
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground()
        SettingsScreen()
    }
}
