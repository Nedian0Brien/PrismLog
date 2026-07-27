import SwiftUI

/// Horizontal run of session photos. Tapping one opens the viewer.
struct PhotoStrip: View {
    let photos: [URL]
    var accent: PrismAccent = .reading
    var height: CGFloat = 92

    @State private var viewing: Int?

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Array(photos.enumerated()), id: \.offset) { index, url in
                    Button {
                        viewing = index
                    } label: {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            case .failure:
                                Image(systemName: "photo")
                                    .foregroundStyle(accent.color.opacity(0.5))
                            default:
                                ProgressView().controlSize(.small)
                            }
                        }
                        .frame(width: height * 0.82, height: height)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(PrismColor.hairline, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("사진 \(index + 1)")
                }
            }
            .padding(.horizontal, 1)
        }
        .scrollIndicators(.hidden)
        .fullScreenCover(item: Binding(
            get: { viewing.map(PhotoIndex.init) },
            set: { viewing = $0?.value }
        )) { start in
            PhotoViewer(photos: photos, startIndex: start.value)
        }
    }

    private struct PhotoIndex: Identifiable {
        let value: Int
        var id: Int { value }
    }
}

/// Full-screen photo viewer with paging. Replaces the web's `Lightbox`.
struct PhotoViewer: View {
    let photos: [URL]
    let startIndex: Int

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int

    init(photos: [URL], startIndex: Int) {
        self.photos = photos
        self.startIndex = startIndex
        _index = State(initialValue: startIndex)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.offset) { offset, url in
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFit()
                        case .failure:
                            ContentUnavailableView("사진을 불러올 수 없습니다", systemImage: "photo")
                        default:
                            ProgressView()
                        }
                    }
                    .tag(offset)
                }
            }
            .tabViewStyle(.page)
            .ignoresSafeArea()
        }
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .padding(11)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.circle)
            .padding(18)
            .accessibilityLabel("닫기")
        }
        .overlay(alignment: .bottom) {
            if photos.count > 1 {
                Text("\(index + 1) / \(photos.count)")
                    .font(.prismCaption)
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background { Capsule().fill(.black.opacity(0.45)) }
                    .padding(.bottom, 28)
            }
        }
    }
}
