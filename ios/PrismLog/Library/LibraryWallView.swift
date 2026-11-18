import SwiftUI
import UIKit

/// Distinct rows before layout A's pattern repeats vertically. Ten covers
/// all five categories twice, so a repeat never stacks two identical rows.
enum WallRowsPattern {
    static let rowCount = 10
}

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
    /// This wall is the library's: it tells the model where its rows are,
    /// for the stage. The other tabs' walls share the model but not that.
    var reportsLayout = false

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
                let _ = model.focusSettles
                TimelineView(.animation(paused: model.isPaused && !model.focus.isMoving(at: .now))) { timeline in
                    let date = timeline.date
                    let elapsed = model.elapsed(at: date) * model.speedScale
                    let focus = model.focus
                    let dim = focus.dim(at: date)
                    let heroes = stageHeroes(focus: focus, date: date)
                    let hidden = Dictionary(
                        heroes.compactMap { item in item.hero.row.flatMap { row in item.hero.position.map { (row, $0) } } },
                        uniquingKeysWith: { first, _ in first }
                    )
                    ZStack {
                        // Every poster lit from behind: a blurred copy of
                        // the wall underneath spills each cover's colour
                        // into the dark around it.
                        ZStack {
                            flowing(covers: covers, elapsed: elapsed, date: date, hidden: hidden)
                                .blur(radius: WallTheater.glowRadius)
                                .saturation(1.4)
                                .opacity(WallTheater.glowOpacity)
                                .allowsHitTesting(false)
                            flowing(covers: covers, elapsed: elapsed, date: date, hidden: hidden)
                        }
                        // The covers around the stage step back.
                        .brightness(-WallTheater.stageDimming * dim)
                        .blur(radius: WallTheater.stageBlur * dim)
                        .allowsHitTesting(dim < 0.5)
                        .modifier(WallLegibilityLayer(
                            mode: model.revealed ? .revealed : .standard,
                            dimmingOverride: model.revealed ? nil : dimmingOverride
                        ))

                        ForEach(heroes, id: \.hero.id) { item in
                            HeroPoster(
                                cover: item.cover,
                                preview: model.images[item.cover.id],
                                from: item.from,
                                to: item.to,
                                growth: item.growth,
                                startCorner: metrics.corner,
                                onSelect: model.revealed ? onSelect : nil
                            )
                            // Above the dimming, so it hangs bright; behind
                            // the page's cards it steps down with the wall.
                            .brightness(model.revealed ? 0 : -0.3)
                        }
                    }
                }
                .animation(.easeInOut(duration: 0.35), value: model.revealed)
            }
        }
        .animation(.easeInOut(duration: 0.45), value: model.context)
        .ignoresSafeArea()
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size in
            if reportsLayout { model.wallSize = size }
        }
        .onChange(of: metrics, initial: true) {
            if reportsLayout { model.wallMetrics = metrics }
        }
        .onChange(of: scrollOffset, initial: true) {
            if reportsLayout { model.parallax = Double(scrollOffset * Self.parallaxFactor) }
        }
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

    /// A cover on stage or on its way: where it starts in its row, where it
    /// hangs at full size, and how far between the two it is.
    private struct StageHero {
        let hero: WallFocus.Hero
        let cover: WallCover
        let growth: Double
        let from: CGRect
        let to: CGRect
    }

    private func stageHeroes(focus: WallFocus, date: Date) -> [StageHero] {
        let geometry = model.rowGeometry
        let size = geometry.size
        guard size.width > 0 else { return [] }

        let band = model.posterArea ?? (size.height * 0.1)...(size.height * 0.6)
        let height = min((band.upperBound - band.lowerBound) * 0.86, size.width * 0.66 / GeneratedCover.aspectRatio)
        let width = height * GeneratedCover.aspectRatio
        let to = CGRect(x: (size.width - width) / 2, y: model.stageCentreY - height / 2, width: width, height: height)

        let candidates: [(WallFocus.Hero?, Double)] = [
            (focus.outgoing, focus.outgoingGrowth(at: date)),
            (focus.incoming, focus.incomingGrowth(at: date)),
        ]
        return candidates.compactMap { hero, growth in
            guard let hero, growth > 0, let cover = model.covers.first(where: { $0.id == hero.id }) else { return nil }
            return StageHero(hero: hero, cover: cover, growth: growth, from: rowRect(of: hero, geometry: geometry, date: date) ?? to.insetBy(dx: width * 0.35, dy: height * 0.35), to: to)
        }
    }

    /// The model's placements as covers, for the rows to draw.
    private var placedCovers: [Int: [Int: WallCover]] {
        model.placements.mapValues { positions in
            positions.compactMapValues { id in model.covers.first { $0.id == id } }
        }
    }

    /// Where a stage cover sits in its row right now.
    private func rowRect(of hero: WallFocus.Hero, geometry: WallRowGeometry, date: Date) -> CGRect? {
        guard let row = hero.row, let position = hero.position,
              let slot = geometry.slot(showing: row, near: model.stageCentreY) else { return nil }
        let distance = model.elapsed(at: date) * model.speedScale * WallSpeed.row(row) + model.nudge(row: row, at: date)
        let x = geometry.centreX(ofPosition: position, distance: distance)
        let y = geometry.centreY(ofSlot: slot)
        let m = geometry.metrics
        return CGRect(x: x - m.coverWidth / 2, y: y - m.coverHeight / 2, width: m.coverWidth, height: m.coverHeight)
    }

    @ViewBuilder
    private func flowing(covers: [WallCover], elapsed: TimeInterval, date: Date = .now, hidden: [Int: Int] = [:]) -> some View {
        let parallax = Double(scrollOffset * Self.parallaxFactor)
        switch model.layout {
        case .rows:
            WallRows(
                rows: WallComposition.rows(from: covers, count: WallRows.patternRowCount),
                images: model.images,
                metrics: metrics,
                elapsed: elapsed,
                parallax: parallax,
                nudges: model.nudges,
                date: date,
                hidden: hidden,
                placed: placedCovers,
                onSelect: model.revealed ? onSelect : nil,
                onDrag: model.revealed ? { row, translation in model.dragRow(row, by: translation) } : nil,
                onRelease: { row, velocity in model.releaseRow(row, velocity: velocity) }
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
    /// Rows pushed by hand, by pattern row, and the frame's time to read
    /// their coast at.
    var nudges: [Int: RowNudge] = [:]
    var date = Date()
    /// Strip positions lifted onto the stage, by pattern row: their place
    /// stays empty while they're up.
    var hidden: [Int: Int] = [:]
    /// Covers set into rows for the stage, by pattern row and strip position.
    var placed: [Int: [Int: WallCover]] = [:]
    var onSelect: ((WallCover) -> Void)?
    /// Set while the library is pulled down: a sideways drag pushes a row.
    var onDrag: ((Int, Double) -> Void)?
    var onRelease: ((Int, Double) -> Void)?

    static let patternRowCount = WallRowsPattern.rowCount

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
                        distance: elapsed * WallSpeed.row(rowIndex) + (nudges[rowIndex]?.offset(at: date) ?? 0),
                        pitch: Double(metrics.pitchX)
                    )
                    let y = CGFloat(rowSlot) * metrics.pitchY - CGFloat(vertical.remainder) - metrics.pitchY / 2

                    ZStack(alignment: .topLeading) {
                        ForEach(0..<visibleSlots, id: \.self) { slot in
                            let position = horizontal.shift + slot
                            let cover = placed[rowIndex]?[position] ?? row[horizontal.index(forSlot: slot, itemCount: row.count)]
                            let x = CGFloat(slot) * metrics.pitchX - CGFloat(horizontal.remainder) - metrics.pitchX / 2
                            let lifted = hidden[rowIndex] == position
                            WallTile(image: images[cover.id], accent: cover.accent, metrics: metrics)
                                .opacity(lifted ? 0 : 1)
                                .onTapGesture { onSelect?(cover) }
                                .offset(x: x)
                        }
                    }
                    .frame(width: size.width, height: metrics.coverHeight, alignment: .topLeading)
                    .contentShape(.rect)
                    .gesture(rowDrag(rowIndex), isEnabled: onDrag != nil)
                    .offset(y: y)
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
            .clipped()
        }
    }

    /// A sideways drag moves the row with the finger and lets it coast on
    /// release. Mostly-vertical drags are left alone.
    private func rowDrag(_ row: Int) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                onDrag?(row, Double(value.translation.width))
            }
            .onEnded { value in
                onRelease?(row, Double(value.velocity.width))
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
                        onSelect: open,
                        reportsLayout: tab == .home
                    )
                } else {
                    SpectrumBloomBackground()
                }
            }
    }
}
