import SwiftUI

/// The signature Liquid Glass moment: one glass pebble that splits into the
/// five record colors, the way a prism splits light.
///
/// Replaces the web's FAB → BottomSheet → CategorySelector chain (`src/App.jsx`)
/// with a single continuous morph, which is what `glassEffectID` exists for.
///
/// Note on API choice: buttons here use `.buttonStyle(.glass)`, **not**
/// `.glassEffect(…)`. Wrapping a `Button` in `.glassEffect(.regular.interactive())`
/// renders correctly but swallows every touch — the button stops firing even on
/// a direct coordinate tap. `.glassEffect` is for non-interactive surfaces;
/// controls get the glass button style.
struct PrismComposerButton: View {
    @Binding var isExpanded: Bool
    var onSelect: (PrismAccent) -> Void

    @Namespace private var glass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        // Container spacing stays below the stack spacing on purpose: above it,
        // neighbouring glass shapes attract each other and the chips' trailing
        // edges go visibly ragged.
        GlassEffectContainer(spacing: 10) {
            VStack(alignment: .trailing, spacing: 12) {
                if isExpanded {
                    ForEach(PrismAccent.allCases) { accent in
                        categoryChip(accent)
                    }
                }

                toggleButton
            }
        }
    }

    private var toggleButton: some View {
        Button {
            collapseOrExpand()
        } label: {
            Image(systemName: isExpanded ? "xmark" : "plus")
                .font(.system(size: 22, weight: .semibold))
                .frame(width: 30, height: 30)
                .padding(13)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.glassProminent)
        .buttonBorderShape(.circle)
        .tint(PrismAccent.reading.color)
        .glassEffectID("composer", in: glass)
        .accessibilityLabel(isExpanded ? "기록 작성 닫기" : "새 기록 작성")
        .accessibilityIdentifier("composer.toggle")
    }

    private func categoryChip(_ accent: PrismAccent) -> some View {
        Button {
            onSelect(accent)
            collapseOrExpand()
        } label: {
            HStack(spacing: 9) {
                Image(systemName: accent.symbol)
                    .font(.system(size: 14, weight: .semibold))
                Text(accent.label)
                    .font(.prismHeadline)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 5)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.capsule)
        .tint(accent.color)
        .glassEffectID(accent.rawValue, in: glass)
        .accessibilityIdentifier("composer.chip.\(accent.rawValue)")
    }

    private func collapseOrExpand() {
        withAnimation(reduceMotion ? PrismMotion.snappy : PrismMotion.morph) {
            isExpanded.toggle()
        }
    }
}

#Preview {
    @Previewable @State var expanded = true

    ZStack {
        SpectrumBloomBackground()
        PrismComposerButton(isExpanded: $expanded) { _ in }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(20)
    }
}
