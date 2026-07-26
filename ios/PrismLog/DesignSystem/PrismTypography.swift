import SwiftUI

/// PrismLog keeps the web's Pretendard identity for text, but hands numerals to
/// SF Pro Rounded — geometric like the web's Outfit, and native enough that
/// Dynamic Type and tabular figures come for free.
enum PrismFont {
    enum Weight: String {
        case regular = "Pretendard-Regular"
        case medium = "Pretendard-Medium"
        case semiBold = "Pretendard-SemiBold"
        case bold = "Pretendard-Bold"
        case extraBold = "Pretendard-ExtraBold"
    }

    static func text(
        _ size: CGFloat,
        _ weight: Weight = .regular,
        relativeTo style: Font.TextStyle = .body
    ) -> Font {
        .custom(weight.rawValue, size: size, relativeTo: style)
    }

    /// Rounded system numerals. Always pair with `.monospacedDigit()` when the
    /// value animates so the layout doesn't jitter.
    static func numeral(
        _ size: CGFloat,
        weight: Font.Weight = .bold,
        relativeTo style: Font.TextStyle = .body
    ) -> Font {
        .system(size: size, weight: weight, design: .rounded).width(.standard)
    }
}

extension Font {
    /// Screen titles — "기록 대시보드"
    static let prismDisplay = PrismFont.text(26, .extraBold, relativeTo: .largeTitle)
    /// Section titles — "최근 기록"
    static let prismTitle = PrismFont.text(19, .bold, relativeTo: .title3)
    /// Card titles, list row primary text
    static let prismHeadline = PrismFont.text(16, .semiBold, relativeTo: .headline)
    static let prismBody = PrismFont.text(15, .regular, relativeTo: .body)
    static let prismCallout = PrismFont.text(14, .medium, relativeTo: .callout)
    static let prismCaption = PrismFont.text(12, .medium, relativeTo: .caption)
    static let prismMicro = PrismFont.text(11, .medium, relativeTo: .caption2)
}

extension View {
    /// Applies the muted secondary text treatment used across the app.
    func prismMuted() -> some View {
        foregroundStyle(PrismColor.textMuted)
    }
}
