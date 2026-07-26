import SwiftUI

struct RecordsScreen: View {
    var body: some View {
        PrismScreenScaffold(eyebrow: "Records", title: "기록", focus: .study) {
            PrismGlassSection {
                VStack(spacing: 14) {
                    ForEach(PrismAccent.allCases) { accent in
                        PrismPlaceholderCard(
                            accent: accent,
                            title: accent.label,
                            detail: detail(for: accent)
                        )
                    }
                }
            }
        }
    }

    private func detail(for accent: PrismAccent) -> String {
        switch accent {
        case .reading: "진척도, 필사, 평점과 독서 세션 기록."
        case .study: "목차 관리, 학습 목표, 회고."
        case .movie: "관람 상태와 평점."
        case .series: "시즌·에피소드 시청 진행률."
        case .game: "플레이 세션과 누적 플레이타임."
        }
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground(focus: .study)
        RecordsScreen()
    }
}
