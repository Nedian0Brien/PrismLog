import SwiftUI

struct HomeScreen: View {
    var body: some View {
        PrismScreenScaffold(eyebrow: "Dashboard", title: "기록 대시보드", focus: .reading) {
            PrismGlassSection {
                VStack(spacing: 14) {
                    PrismPlaceholderCard(
                        accent: .reading,
                        title: "스펙트럼 링",
                        detail: "카테고리별 기록 비율을 하나의 굴절 링으로 보여줍니다."
                    )
                    PrismPlaceholderCard(
                        accent: .study,
                        title: "추세선 · 히트맵",
                        detail: "최근 14일 누적 추세와 5주 활동 히트맵."
                    )
                    PrismPlaceholderCard(
                        accent: .movie,
                        title: "최근 기록",
                        detail: "방금 남긴 기록을 바로 확인합니다."
                    )
                }
            }
        }
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground(focus: .reading)
        HomeScreen()
    }
}
