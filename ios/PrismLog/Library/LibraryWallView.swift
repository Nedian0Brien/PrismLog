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

    // Wide gaps: each poster hangs in its own patch of dark, with room for
    // its light to spill (the theater look, 2026-11-19).
    static let compact = WallMetrics(coverHeight: 132, coverSpacing: 18, rowSpacing: 22, corner: 6)
    static let regular = WallMetrics(coverHeight: 168, coverSpacing: 22, rowSpacing: 26, corner: 8)
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
    /// Opens a cover's record, while the library is pulled down.
    var onSelect: ((WallCover) -> Void)?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    /// Settings' "표지 벽 흐름" switch (spec §6.4).
    @AppStorage(LibraryWallView.flowSettingKey) private var flowEnabled = true

    static let flowSettingKey = "wall.flowEnabled"
    static let parallaxFactor: CGFloat = 0.35

    private var metrics: WallMetrics {
        horizontalSizeClass == .regular ? .regular : .compact
    }

    var body: some View {
        let covers = model.visibleCovers

        ZStack {
            WallTheater.darkness

            if covers.isEmpty {
                SpectrumBloomBackground()
            } else if case .hero(let id) = model.context, let image = model.images[id] {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .modifier(WallLegibilityLayer(mode: .hero, dimmingOverride: dimmingOverride))
            } else {
                TimelineView(.animation(paused: model.isPaused && !model.stage.isMoving(at: .now))) { timeline in
                    let elapsed = model.elapsed(at: timeline.date) * model.speedScale
                    let stage = model.isPaused ? model.stage.progress(at: .distantFuture) : model.stage.progress(at: timeline.date)
                    ZStack {
                        if stage < 1 {
                            // Every poster lit from behind: a blurred copy of
                            // the wall underneath spills each cover's colour
                            // into the dark around it.
                            ZStack {
                                flowing(covers: covers, elapsed: elapsed, departure: stage)
                                    .blur(radius: WallTheater.glowRadius)
                                    .saturation(1.4)
                                    .opacity(WallTheater.glowOpacity)
                                flowing(covers: covers, elapsed: elapsed, departure: stage)
                            }
                        }
                        if stage > 0 {
                            FeaturedPosters(
                                covers: model.lastFeature.compactMap { id in model.covers.first { $0.id == id } },
                                previews: model.images,
                                position: model.featurePosition,
                                entrance: stage
                            )
                        }
                    }
                }
                .modifier(WallLegibilityLayer(
                    mode: .standard,
                    dimmingOverride: model.revealed ? WallTheater.revealedDimming : dimmingOverride
                ))
                .animation(.easeInOut(duration: 0.35), value: model.revealed)
            }
        }
        .animation(.easeInOut(duration: 0.45), value: model.context)
        .ignoresSafeArea()
        .allowsHitTesting(model.revealed && onSelect != nil)
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
    private func flowing(covers: [WallCover], elapsed: TimeInterval, departure: Double = 0) -> some View {
        let parallax = Double(scrollOffset * Self.parallaxFactor)
        switch model.layout {
        case .rows:
            WallRows(
                rows: WallComposition.rows(from: covers, count: WallRows.patternRowCount),
                images: model.images,
                metrics: metrics,
                elapsed: elapsed,
                parallax: parallax,
                departure: departure,
                onSelect: model.revealed ? onSelect : nil
            )
        case .mosaic:
            WallMosaic(
                sequence: WallComposition.mosaic(from: covers),
                images: model.images,
                metrics: metrics,
                elapsed: elapsed,
                parallax: parallax
            )
            .opacity(1 - departure)
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
    /// 0 at rest; toward 1 each row rushes off in its own direction and fades.
    var departure: Double = 0
    var onSelect: ((WallCover) -> Void)?

    /// Rows leave one after another, this far apart in `departure`.
    static let departureStagger = 0.08

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
                    let speed = WallSpeed.row(rowIndex)
                    let rush = Self.rush(departure: departure, slot: rowSlot)
                    let horizontal = WallStrip(
                        distance: elapsed * speed + (speed < 0 ? -1 : 1) * rush * Double(size.width) * 3,
                        pitch: Double(metrics.pitchX)
                    )
                    let y = CGFloat(rowSlot) * metrics.pitchY - CGFloat(vertical.remainder) - metrics.pitchY / 2

                    ForEach(0..<visibleSlots, id: \.self) { slot in
                        let cover = row[horizontal.index(forSlot: slot, itemCount: row.count)]
                        WallTile(image: images[cover.id], accent: cover.accent, metrics: metrics)
                            .opacity(1 - rush)
                            .onTapGesture { onSelect?(cover) }
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

    /// How far a row has gone, 0–1, eased in so it gathers speed as it leaves.
    static func rush(departure: Double, slot: Int) -> Double {
        guard departure > 0 else { return 0 }
        let delay = Double(slot % 4) * departureStagger
        let local = min(max((departure - delay) / (1 - departureStagger * 3), 0), 1)
        return local * local * local
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

    /// A tapped cover on the pulled-down library opens its newest record.
    private func open(_ cover: WallCover) {
        guard let tab, let navigation, let id = cover.recordID else { return }
        PrismHaptics.selection()
        navigation.paths[tab, default: []].append(id)
    }

    func body(content: Content) -> some View {
        content
            .containerBackground(.clear, for: .navigation)
            .background {
                if let wall {
                    LibraryWallView(
                        model: wall,
                        scrollOffset: tab.flatMap { navigation?.scrollOffsets[$0] } ?? 0,
                        onSelect: open
                    )
                } else {
                    SpectrumBloomBackground()
                }
            }
    }
}
