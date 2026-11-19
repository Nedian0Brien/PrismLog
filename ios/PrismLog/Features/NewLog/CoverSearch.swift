import SwiftUI

/// The pieces the "add" sheets share: a dark stage behind them, search
/// results as a wall of covers, cover-shaped placeholders while they load,
/// and a one-line failure with a way to try again (2026-11-19 redesign).

/// A search to start the add sheets with, for screenshots and checks on a
/// simulator that can't take typed text: `-AddSheetQuery dune`. Debug only.
var debugAddSheetQuery: String {
    #if DEBUG
    UserDefaults.standard.string(forKey: "AddSheetQuery") ?? ""
    #else
    ""
    #endif
}

/// One result as a cover on the grid.
struct CoverSearchTile: Identifiable, Hashable {
    let id: String
    let title: String
    /// Author, year, or episode count — one short line.
    let subtitle: String?
    let coverURL: URL?
    let accent: PrismAccent
}

/// The dark theater the wall uses, with the category's light falling
/// faintly from the top.
struct TheaterSheetBackground: View {
    let accent: PrismAccent

    var body: some View {
        ZStack(alignment: .top) {
            WallTheater.darkness
            EllipticalGradient(
                colors: [accent.color.opacity(0.14), .clear],
                center: .top,
                startRadiusFraction: 0,
                endRadiusFraction: 0.55
            )
            .frame(height: 420)
        }
        .ignoresSafeArea()
    }
}

/// Results as covers: what people recognise first is the cover, so it
/// leads, large, with the title under it.
struct CoverGrid: View {
    let tiles: [CoverSearchTile]
    var namespace: Namespace.ID?
    let onPick: (CoverSearchTile) -> Void

    static let columns = [GridItem(.adaptive(minimum: 148, maximum: 220), spacing: 16, alignment: .top)]

    var body: some View {
        LazyVGrid(columns: Self.columns, alignment: .leading, spacing: 22) {
            ForEach(tiles) { tile in
                Button {
                    onPick(tile)
                } label: {
                    CoverTileView(tile: tile, namespace: namespace)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("coversearch.result")
            }
        }
    }
}

struct CoverTileView: View {
    let tile: CoverSearchTile
    var namespace: Namespace.ID?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            cover
                .aspectRatio(GeneratedCover.aspectRatio, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .shadow(color: .black.opacity(0.45), radius: 14, y: 8)

            Text(tile.title)
                .font(.prismHeadline)
                .foregroundStyle(PrismColor.text)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            if let subtitle = tile.subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.prismMicro)
                    .prismMuted()
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
    }

    @ViewBuilder
    private var cover: some View {
        let image = CoverImage(url: tile.coverURL, accent: tile.accent, title: tile.title, cornerRadius: 8)
        if let namespace {
            image.matchedGeometryEffect(id: tile.id, in: namespace)
        } else {
            image
        }
    }
}

/// Cover-shaped places while results load, so the grid doesn't jump when
/// they arrive.
struct CoverGridSkeleton: View {
    let accent: PrismAccent
    @State private var dim = false

    var body: some View {
        LazyVGrid(columns: CoverGrid.columns, alignment: .leading, spacing: 22) {
            ForEach(0..<6, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(accent.color.opacity(0.10))
                        .aspectRatio(GeneratedCover.aspectRatio, contentMode: .fit)
                    Capsule().fill(PrismColor.text.opacity(0.08)).frame(height: 12)
                    Capsule().fill(PrismColor.text.opacity(0.06)).frame(width: 70, height: 9)
                }
            }
        }
        .opacity(dim ? 0.55 : 1)
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: dim)
        .onAppear { dim = true }
        .accessibilityLabel("검색 중")
    }
}

/// A failed search, in one plain line, with a way to try again. The
/// server's own message goes to the log, not to the person.
struct SearchFailureLine: View {
    let accent: PrismAccent
    let error: Error
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text(Self.message(for: error))
                .font(.prismCallout)
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.center)

            Button("다시 시도", systemImage: "arrow.clockwise", action: retry)
                .font(.prismCallout)
                .buttonStyle(.glass)
                .tint(accent.color)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("coversearch.failure")
    }

    static func message(for error: Error) -> String {
        if let urlError = error as? URLError,
           [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(urlError.code) {
            return "인터넷 연결을 확인해 주세요."
        }
        return "지금은 검색할 수 없습니다. 잠시 후 다시 시도해 주세요."
    }
}

/// The picked cover, large, leading the form below it.
struct SelectedCoverHeader: View {
    let tile: CoverSearchTile
    /// One more line under the subtitle — page count, episode count.
    var detail: String?
    var namespace: Namespace.ID?

    var body: some View {
        VStack(spacing: 12) {
            cover
                .frame(width: 148, height: 148 / GeneratedCover.aspectRatio)
                .shadow(color: .black.opacity(0.55), radius: 24, y: 14)

            Text(tile.title)
                .font(.prismTitle)
                .foregroundStyle(PrismColor.text)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if let line = [tile.subtitle, detail].compactMap({ $0 }).filter({ !$0.isEmpty }).joined(separator: " · ").nilIfEmpty {
                Text(line)
                    .font(.prismCaption)
                    .prismMuted()
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var cover: some View {
        let image = CoverImage(url: tile.coverURL, accent: tile.accent, title: tile.title, cornerRadius: 10)
        if let namespace {
            image.matchedGeometryEffect(id: tile.id, in: namespace)
        } else {
            image
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
