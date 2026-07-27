import UIKit

/// Downscale + JPEG encode before upload, matching the web's `compressImage`
/// (`src/features/prismlog/ui.jsx:867`) so photos from either client land at a
/// comparable size. The server rejects anything over 10MB.
enum ImageCompressor {
    static let maxDimension: CGFloat = 1920
    static let quality: CGFloat = 0.85

    static func jpeg(from data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }

        let longest = max(image.size.width, image.size.height)
        guard longest > maxDimension else {
            return image.jpegData(compressionQuality: quality)
        }

        let scale = maxDimension / longest
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }

        return resized.jpegData(compressionQuality: quality)
    }
}
