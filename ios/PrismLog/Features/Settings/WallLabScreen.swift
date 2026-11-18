#if DEBUG
import SwiftUI

/// The library wall with glass samples on top, for choosing layout A or B
/// (D2) and tuning speed and dimming before the wall goes behind real screens.
///
/// Launch arguments open it directly for recordings and Instruments runs:
/// `-WallLab YES -WallLabLayout mosaic -WallLabSource synthetic200 -WallLabHideControls YES`,
/// plus `-WallLabDimming 0.7` to pin the dimming.
struct WallLabScreen: View {
    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var wall = LibraryWallModel()
    @State private var source: WallFixtureSource
    @State private var contextChoice: ContextChoice = .all
    @State private var overridesDimming = false
    @State private var dimming = 0.45
    @State private var scrollOffset: CGFloat = 0
    @State private var showsControls: Bool
    @State private var meter = WallFrameMeter()

    init() {
        let defaults = UserDefaults.standard
        let source = defaults.string(forKey: "WallLabSource").flatMap(WallFixtureSource.init(rawValue:))
        _source = State(initialValue: source ?? .library)
        _showsControls = State(initialValue: !defaults.bool(forKey: "WallLabHideControls"))
        if defaults.object(forKey: "WallLabDimming") != nil {
            _overridesDimming = State(initialValue: true)
            _dimming = State(initialValue: defaults.double(forKey: "WallLabDimming"))
        }
    }

    static var opensOnLaunch: Bool {
        UserDefaults.standard.bool(forKey: "WallLab")
    }

    private enum ContextChoice: String, CaseIterable, Identifiable {
        case all, reading, movie, game, series, study, hero, still
        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: "전체"
            case .hero: "히어로"
            case .still: "정지"
            default: accent?.label ?? rawValue
            }
        }

        var accent: PrismAccent? {
            switch self {
            case .reading: .reading
            case .movie: .movie
            case .game: .game
            case .series: .series
            case .study: .study
            default: nil
            }
        }
    }

    var body: some View {
        ZStack {
            LibraryWallView(
                model: wall,
                scrollOffset: scrollOffset,
                dimmingOverride: overridesDimming ? dimming : nil
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    samples
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top
            } action: { _, offset in
                scrollOffset = offset
            }
        }
        .safeAreaInset(edge: .bottom) {
            if showsControls { controls }
        }
        .task { applyLaunchLayout() }
        .onAppear { meter.start() }
        .onDisappear { meter.stop() }
        .onChange(of: meterLabel, initial: true) { meter.label = meterLabel }
        .task(id: source) { applySource() }
        .onChange(of: store.records) { if source == .library { wall.update(records: store.records) } }
        .onChange(of: contextChoice) { applyContext() }
        .onChange(of: wall.imagePixelBucket) { applySource() }
    }

    // MARK: Foreground

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("DEBUG")
                    .font(.prismMicro)
                    .foregroundStyle(PrismColor.textMuted)
                Text("표지 벽 실험실")
                    .font(.prismDisplay)
                    .foregroundStyle(PrismColor.text)
            }
            Spacer()
            Button("닫기", systemImage: "xmark") { dismiss() }
                .labelStyle(.iconOnly)
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
            Button(showsControls ? "조절 숨기기" : "조절 보기", systemImage: "slider.horizontal.3") {
                withAnimation(PrismMotion.morph) { showsControls.toggle() }
            }
            .labelStyle(.iconOnly)
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
        }
    }

    /// Glass over the wall in each combination spec §5 uses: `.regular` for
    /// text-heavy cards, `.clear` for the lens card with little text.
    private var samples: some View {
        GlassEffectContainer(spacing: 14) {
            VStack(spacing: 14) {
                sampleCard(glass: .clear, label: "clear · 글 적음") {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("지금 읽는 중")
                            .font(.prismCaption)
                            .foregroundStyle(PrismColor.textMuted)
                        Text("무너지는 제국")
                            .font(.prismTitle)
                            .foregroundStyle(PrismColor.text)
                        ProgressView(value: 0.62)
                            .tint(PrismAccent.reading.color)
                    }
                }

                sampleCard(glass: .regular, label: "regular · 글 많음") {
                    Text("""
                    한 권을 끝까지 읽는 데 걸린 시간은 열하루였다. 출퇴근 지하철에서 \
                    마흔 쪽씩, 주말에는 카페에서 백 쪽 가까이 넘겼다. 마지막 장을 덮고 \
                    나서야 처음 표시해 둔 문장으로 돌아갔다.
                    """)
                    .font(.prismBody)
                    .foregroundStyle(PrismColor.text)
                }

                HStack(spacing: 14) {
                    sampleCard(glass: .regular, label: "regular · 숫자") {
                        stat("이번 달", "12건")
                    }
                    sampleCard(glass: .clear, label: "clear · 숫자") {
                        stat("연속 기록", "9일")
                    }
                }

                sampleCard(glass: .clear, label: "clear · 글 많음") {
                    Text("투명 글래스 위의 긴 본문은 표지가 밝을수록 읽기 어려워진다. spec은 이 조합을 쓰지 않는다. 비교용으로만 둔다.")
                        .font(.prismBody)
                        .foregroundStyle(PrismColor.text)
                }

                // Room to scroll, so the wall's parallax can be judged.
                ForEach(0..<6, id: \.self) { index in
                    sampleCard(glass: .regular, label: "regular · 목록 \(index + 1)") {
                        stat("기록 \(index + 1)", "\(index * 7 + 3)p")
                    }
                }
            }
        }
        .padding(.bottom, 24)
    }

    private func sampleCard(glass: Glass, label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.prismMicro)
                .foregroundStyle(PrismColor.textMuted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .glassEffect(glass, in: .rect(cornerRadius: PrismGlassMetrics.cardCorner))
    }

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.prismCaption)
                .foregroundStyle(PrismColor.textMuted)
            Text(value)
                .font(PrismFont.numeral(24))
                .foregroundStyle(PrismColor.text)
        }
    }

    // MARK: Controls

    private var controls: some View {
        @Bindable var wall = wall

        return VStack(alignment: .leading, spacing: 10) {
            Picker("배치", selection: $wall.layout) {
                Text("A · 가로 행").tag(WallLayout.rows)
                Text("B · 모자이크").tag(WallLayout.mosaic)
            }
            .pickerStyle(.segmented)

            Picker("표지", selection: $source) {
                ForEach(WallFixtureSource.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.menu)

            HStack {
                Picker("맥락", selection: $contextChoice) {
                    ForEach(ContextChoice.allCases) { Text($0.label).tag($0) }
                }
                Spacer()
                Picker("해상도", selection: $wall.imagePixelBucket) {
                    Text("256px").tag(256)
                    Text("512px").tag(512)
                }
            }

            labeledSlider("속도 ×\(wall.speedScale.formatted(.number.precision(.fractionLength(1))))",
                          value: $wall.speedScale, in: 0...3)

            HStack {
                Toggle("디밍 직접", isOn: $overridesDimming)
                    .fixedSize()
                Slider(value: $dimming, in: 0...0.9)
                    .disabled(!overridesDimming)
                Text(dimming.formatted(.number.precision(.fractionLength(2))))
                    .monospacedDigit()
            }

            Text(readout)
                .font(.prismMicro)
                .monospacedDigit()
                .foregroundStyle(PrismColor.textMuted)
        }
        .font(.prismCaption)
        .padding(14)
        .glassEffect(.regular, in: .rect(cornerRadius: PrismGlassMetrics.cardCorner))
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
    }

    private func labeledSlider(_ label: String, value: Binding<Double>, in range: ClosedRange<Double>) -> some View {
        HStack {
            Text(label).monospacedDigit().frame(width: 72, alignment: .leading)
            Slider(value: value, in: range)
        }
    }

    /// Tags each console report with what was on screen.
    private var meterLabel: String {
        let megabytes = Double(wall.decodedBytes) / 1_048_576
        return "layout=\(wall.layout.rawValue) source=\(source.rawValue) covers=\(wall.images.count) px=\(wall.imagePixelBucket) wall=\(String(format: "%.1f", megabytes))MB"
    }

    private var readout: String {
        let megabytes = Double(wall.decodedBytes) / 1_048_576
        let paused = wall.pauseReasons.isEmpty ? "흐르는 중" : "정지: \(wall.pauseReasons.map { "\($0)" }.sorted().joined(separator: ", "))"
        let hitch = meter.hitchMillisecondsPerSecond.formatted(.number.precision(.fractionLength(1)))
        let fps = meter.framesPerSecond.formatted(.number.precision(.fractionLength(0)))
        return "표지 \(wall.visibleCovers.count) · 디코딩 \(wall.images.count) · \(megabytes.formatted(.number.precision(.fractionLength(1))))MB · \(paused) · hitch \(hitch)ms/s · \(fps)fps"
    }

    // MARK: Actions

    private func applyLaunchLayout() {
        if let layout = UserDefaults.standard.string(forKey: "WallLabLayout").flatMap(WallLayout.init(rawValue:)) {
            wall.layout = layout
        }
    }

    private func applySource() {
        if case let (covers, images)? = WallFixtures.make(source, maxPixel: wall.imagePixelBucket) {
            wall.useFixture(covers: covers, images: images)
        } else {
            wall.update(records: store.records)
        }
        applyContext()
    }

    private func applyContext() {
        switch contextChoice {
        case .all:
            wall.context = .all
        case .still:
            wall.context = .still
        case .hero:
            wall.context = wall.covers.first.map { .hero($0.id) } ?? .all
        default:
            wall.context = contextChoice.accent.map { .category($0) } ?? .all
        }
    }
}
#endif
