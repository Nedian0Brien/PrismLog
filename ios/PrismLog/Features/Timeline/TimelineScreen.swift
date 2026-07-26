import SwiftUI

struct TimelineScreen: View {
    var body: some View {
        PrismScreenScaffold(eyebrow: "Timeline", title: "타임라인", focus: .movie) {
            PrismGlassSection {
                PrismPlaceholderCard(
                    accent: .movie,
                    title: "날짜별 기록",
                    detail: "모든 카테고리의 기록을 발생 시각 순서로 모아 봅니다."
                )
            }
        }
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground(focus: .movie)
        TimelineScreen()
    }
}
