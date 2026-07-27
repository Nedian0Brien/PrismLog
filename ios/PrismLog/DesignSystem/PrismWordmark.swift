import SwiftUI

/// App wordmark. Plain white type, no mark and no glass behind it — in the
/// toolbar it reads as a header rather than as a control.
struct PrismWordmark: View {
    var size: CGFloat = 19

    var body: some View {
        Text("PrismLog")
            .font(PrismFont.text(size, .bold, relativeTo: .headline))
            .foregroundStyle(PrismColor.text)
            .fixedSize()
            .accessibilityAddTraits(.isHeader)
    }
}

/// Standard screen heading: small uppercase eyebrow over a large title.
struct PrismScreenHeader: View {
    let eyebrow: String
    let title: String
    /// Colors the eyebrow. Muted by default; record sections tint it with the
    /// category accent, as the web does.
    var accent: Color = PrismColor.textMuted

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(eyebrow)
                .font(.prismMicro)
                .tracking(1.4)
                .textCase(.uppercase)
                .foregroundStyle(accent)

            Text(title)
                .font(.prismDisplay)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground()
        VStack(spacing: 32) {
            PrismWordmark()
            PrismScreenHeader(eyebrow: "Dashboard", title: "기록 대시보드")
        }
        .padding()
    }
}
