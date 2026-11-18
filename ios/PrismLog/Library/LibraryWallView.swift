import SwiftUI
import UIKit

/// Spec §4.3 sizes. Every cover is cropped to 2:3 so rows keep one rhythm
/// whatever the artwork's own shape.
struct WallMetrics: Equatable {
    let coverHeight: CGFloat
    let coverSpacing: CGFloat
    let rowSpacing: CGFloat
    let corner: CGFloat

    var coverWidth: CGFloat { (coverHeight * GeneratedCover.aspectRatio).rounded() }
    var pitchX: CGFloat { coverWidth + coverSpacing }
    var pitchY: CGFloat { coverHeight + rowSpacing }

    static let compact = WallMetrics(coverHeight: 132, coverSpacing: 10, rowSpacing: 12, corner: 8)
    static let regular = WallMetrics(coverHeight: 168, coverSpacing: 12, rowSpacing: 14, corner: 10)
}

/// Flow speeds, in points per second (spec §4.3, §4.4).
enum WallSpeed {
    /// 8–14 pt/s per row, neighbours in opposite directions. Fixed per row
    /// index so a row keeps its pace when the wall rebuilds.
    static func row(_ index: Int) -> Double {
        let magnitude = 8 + Double((index * 5 + 3) % 7)
        return index.isMultiple(of: 2) ? magnitude : -magnitude
    }

    static let mosaic: Double = 6.5
    /// Mosaic drift direction in grid space, before the −12° tilt.
    static let mosaicDirection = CGVector(dx: 0.89, dy: 0.45)
}

/// The library wall (spec §4). Purely decorative: hidden from VoiceOver and
/// never hit-testable, so it can sit under every screen.
struct LibraryWallView: View {
    let model: LibraryWallModel
    /// How far the foreground has scrolled, in points. The wall moves at
    /// 0.35× of it (spec §4.3).
    var scrollOffset: CGFloat = 0
    /// Overrides the legibility layer's dimming — the debug lab's slider.
    var dimmingOverride: Double?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    /// Settings' "표지 벽 흐름" switch (spec §6.4).
    @AppStorage(LibraryWallView.flowSettingKey) private var flowEnabled = true
    @AppStorage(WallStyle.storageKey) private var style: WallStyle = .covers

    static let flowSettingKey = "wall.flowEnabled"
    static let parallaxFactor: CGFloat = 0.35

    private var metrics: WallMetrics {
        horizontalSizeClass == .regular ? .regular : .compact
    }

    var body: some View {
        let covers = model.visibleCovers

        ZStack {
            PrismColor.background

            if covers.isEmpty {
                SpectrumBloomBackground()
            } else if style == .covers, case .hero(let id) = model.context, let image = model.images[id] {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .modifier(WallLegibilityLayer(mode: .hero, style: style, dimmingOverride: dimmingOverride))
            } else {
                styled(covers: covers)
                    .modifier(WallLegibilityLayer(mode: .standard, style: style, dimmingOverride: dimmingOverride))
                if style != .covers {
                    WallGrain()
                }
            }
        }
        .animation(.easeInOut(duration: 0.45), value: model.context)
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear(perform: syncPauseReasons)
        .onChange(of: scenePhase) { syncPauseReasons() }
        .onChange(of: reduceMotion) { syncPauseReasons() }
        .onChange(of: reduceTransparency) { syncPauseReasons() }
        .onChange(of: flowEnabled) { syncPauseReasons() }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            syncPauseReasons()
        }
    }

    @ViewBuilder
    private func styled(covers: [WallCover]) -> some View {
        let parallax = Double(scrollOffset * Self.parallaxFactor)
        switch style {
        case .covers:
            TimelineView(.animation(paused: model.isPaused)) { timeline in
                flowing(covers: covers, elapsed: model.elapsed(at: timeline.date) * model.speedScale)
            }
        case .featured:
            // Still: the only motion is the page's own parallax.
            let cover = featuredCover(from: covers)
            FeaturedCoverBackdrop(
                cover: cover,
                preview: cover.flatMap { model.images[$0.id] },
                swatches: cover.flatMap { model.palettes[$0.id] } ?? [],
                parallax: parallax
            )
        case .spectrum:
            let columns = spectrumColumns(for: covers)
            TimelineView(.animation(paused: model.isPaused)) { timeline in
                SpectrumMeshLight(
                    columns: columns,
                    elapsed: model.elapsed(at: timeline.date) * model.speedScale,
                    parallax: parallax
                )
            }
            .animation(.easeInOut(duration: 0.8), value: columns)
        }
    }

    /// The cover a context is about: the record in progress on the
    /// library, the latest on a shelf, the record itself on its detail.
    private func featuredCover(from covers: [WallCover]) -> WallCover? {
        if case .all = model.context, let id = model.featuredID, let match = covers.first(where: { $0.id == id }) {
            return match
        }
        return covers.first { $0.coverURL != nil } ?? covers.first
    }

    /// Two or three related colours, the way Apple Music lights a song —
    /// the featured cover's own, then its category's. Only when a cover
    /// has too few does the library's spectrum fill in.
    private func spectrumColumns(for covers: [WallCover]) -> [CoverPalette.Swatch] {
        let featured = featuredCover(from: covers).map { [$0] } ?? []
        var columns = SpectrumMeshLight.paletteColumns(covers: featured, palettes: model.palettes)
        if columns.count < 2 {
            for swatch in SpectrumMeshLight.spectrumColumns(for: covers) where !columns.contains(swatch) {
                columns.append(swatch)
            }
        }
        return Array(columns.prefix(3))
    }

    @ViewBuilder
    private func flowing(covers: [WallCover], elapsed: TimeInterval) -> some View {
        let parallax = Double(scrollOffset * Self.parallaxFactor)
        switch model.layout {
        case .rows:
            WallRows(
                rows: WallComposition.rows(from: covers, count: WallRows.patternRowCount),
                images: model.images,
                metrics: metrics,
                elapsed: elapsed,
                parallax: parallax
            )
        case .mosaic:
            WallMosaic(
                sequence: WallComposition.mosaic(from: covers),
                images: model.images,
                metrics: metrics,
                elapsed: elapsed,
                parallax: parallax
            )
        }
    }

    private func syncPauseReasons() {
        model.setPaused(scenePhase != .active, for: .sceneInactive)
        model.setPaused(reduceMotion, for: .reduceMotion)
        model.setPaused(reduceTransparency, for: .reduceTransparency)
        model.setPaused(ProcessInfo.processInfo.isLowPowerModeEnabled, for: .lowPowerMode)
        model.setPaused(!flowEnabled, for: .disabledInSettings)
    }
}

// MARK: - Layout A

/// Category rows, each drifting at its own pace, neighbours in opposite
/// directions. Rows and slots are virtualized: only the covers on screen
/// exist as views, and a row of any length loops without a seam.
private struct WallRows: View {
    let rows: [[WallCover]]
    let images: [WallCover.ID: UIImage]
    let metrics: WallMetrics
    let elapsed: TimeInterval
    let parallax: Double

    /// Distinct rows before the pattern repeats vertically. Ten covers all
    /// five categories twice, so a repeat never stacks two identical rows.
    static let patternRowCount = 10

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let vertical = WallStrip(distance: parallax, pitch: Double(metrics.pitchY))
            let visibleRows = Int((size.height / metrics.pitchY).rounded(.up)) + 2
            let visibleSlots = Int((size.width / metrics.pitchX).rounded(.up)) + 2

            ZStack(alignment: .topLeading) {
                ForEach(0..<visibleRows, id: \.self) { rowSlot in
                    let rowIndex = vertical.index(forSlot: rowSlot, itemCount: rows.count)
                    let row = rows[rowIndex]
                    let horizontal = WallStrip(
                        distance: elapsed * WallSpeed.row(rowIndex),
                        pitch: Double(metrics.pitchX)
                    )
                    let y = CGFloat(rowSlot) * metrics.pitchY - CGFloat(vertical.remainder) - metrics.pitchY / 2

                    ForEach(0..<visibleSlots, id: \.self) { slot in
                        let cover = row[horizontal.index(forSlot: slot, itemCount: row.count)]
                        WallTile(image: images[cover.id], accent: cover.accent, metrics: metrics)
                            .offset(
                                x: CGFloat(slot) * metrics.pitchX - CGFloat(horizontal.remainder) - metrics.pitchX / 2,
                                y: y
                            )
                    }
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .clipped()
        }
    }
}

// MARK: - Layout B

/// A dense mosaic tilted −12°, drifting along its diagonal (spec §4.4).
/// Odd columns sit half a cover lower, so the tilt reads as staggered
/// bricks rather than a rotated spreadsheet.
private struct WallMosaic: View {
    let sequence: [WallCover]
    let images: [WallCover.ID: UIImage]
    let metrics: WallMetrics
    let elapsed: TimeInterval
    let parallax: Double

    static let tilt: Angle = .degrees(-12)

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            // The tilted grid must still cover the corners: size it to the
            // screen's diagonal plus a cover of margin on every side.
            let side = (size.width * size.width + size.height * size.height).squareRoot()
                + metrics.coverHeight * 2
            let travel = elapsed * WallSpeed.mosaic
            let horizontal = WallStrip(
                distance: travel * Double(WallSpeed.mosaicDirection.dx),
                pitch: Double(metrics.pitchX)
            )
            let vertical = WallStrip(
                distance: travel * Double(WallSpeed.mosaicDirection.dy) + parallax,
                pitch: Double(metrics.pitchY)
            )
            let columns = Int((side / metrics.pitchX).rounded(.up)) + 2
            let rows = Int((side / metrics.pitchY).rounded(.up)) + 2

            ZStack(alignment: .topLeading) {
                ForEach(0..<columns, id: \.self) { column in
                    let absoluteColumn = column + horizontal.shift
                    let stagger = absoluteColumn.isMultiple(of: 2) ? 0 : metrics.pitchY / 2

                    ForEach(0..<rows, id: \.self) { row in
                        let cover = sequence[
                            WallMosaicIndex.index(column: absoluteColumn, row: row + vertical.shift, count: sequence.count)
                        ]
                        WallTile(image: images[cover.id], accent: cover.accent, metrics: metrics)
                            .offset(
                                x: CGFloat(column) * metrics.pitchX - CGFloat(horizontal.remainder) - metrics.pitchX,
                                y: CGFloat(row) * metrics.pitchY - CGFloat(vertical.remainder) + stagger - metrics.pitchY
                            )
                    }
                }
            }
            .frame(width: side, height: side, alignment: .topLeading)
            .rotationEffect(Self.tilt)
            .frame(width: size.width, height: size.height)
            .clipped()
        }
    }
}

// MARK: - Tile

private struct WallTile: View {
    let image: UIImage?
    let accent: PrismAccent
    let metrics: WallMetrics

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                // A cover still decoding holds its place in the category's
                // tone instead of leaving a hole in the wall.
                accent.tone.main.opacity(0.35)
            }
        }
        .frame(width: metrics.coverWidth, height: metrics.coverHeight)
        .clipShape(.rect(cornerRadius: metrics.corner, style: .continuous))
    }
}

// MARK: - Page background

extension View {
    /// Puts the library wall behind a page (spec §4.6, fallback layout).
    ///
    /// `TabView` paints an opaque background over anything laid beneath it
    /// (checked on the iOS 27.2 iPhone Duo simulator, Phase 3), so the wall
    /// can't be laid once at the root. Every page draws it instead, all from
    /// the one shared `LibraryWallModel` — one clock, one set of decoded
    /// covers — so moving between tabs and pushes never restarts the flow.
    func prismWallBackground() -> some View {
        modifier(PrismWallBackground())
    }
}

private struct PrismWallBackground: ViewModifier {
    @Environment(LibraryWallModel.self) private var wall: LibraryWallModel?
    @Environment(AppNavigationModel.self) private var navigation: AppNavigationModel?
    @Environment(\.prismTab) private var tab

    func body(content: Content) -> some View {
        content
            .containerBackground(.clear, for: .navigation)
            .background {
                if let wall {
                    LibraryWallView(
                        model: wall,
                        scrollOffset: tab.flatMap { navigation?.scrollOffsets[$0] } ?? 0
                    )
                } else {
                    SpectrumBloomBackground()
                }
            }
    }
}
