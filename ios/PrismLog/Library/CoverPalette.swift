import SwiftUI
import UIKit

/// The few vivid colours a cover is remembered by.
///
/// An average of every pixel turns most posters brown. Instead, pixels are
/// binned by hue and weighted by saturation × brightness, so a small patch
/// of vivid colour outweighs a large grey one — the way Apple Music's
/// backdrops pick up an album's accent rather than its average.
enum CoverPalette {
    /// One swatch, in HSB so the backgrounds can set brightness directly.
    struct Swatch: Equatable, Sendable {
        let hue: Double
        let saturation: Double
        let brightness: Double

        /// The swatch with its brightness and saturation pinned — how a
        /// background keeps a cover's hue but its own legibility.
        func color(brightness: Double, saturation range: ClosedRange<Double> = 0.35...0.8) -> Color {
            Color(
                hue: hue,
                saturation: min(max(saturation, range.lowerBound), range.upperBound),
                brightness: brightness
            )
        }
    }

    /// Pixels this dull or dark say nothing about the cover's colour.
    static let minimumSaturation = 0.18
    static let minimumBrightness = 0.15
    static let hueBins = 18

    /// Up to `count` swatches, most prominent first, each at least two
    /// bins (40°) from the others. Empty for a greyscale cover.
    static func swatches(from image: UIImage, count: Int = 3) -> [Swatch] {
        guard let pixels = pixels(of: image, side: 24) else { return [] }
        return swatches(fromPixels: pixels, count: count)
    }

    static func swatches(fromPixels pixels: [(r: Double, g: Double, b: Double)], count: Int = 3) -> [Swatch] {
        struct Bin { var weight = 0.0, x = 0.0, y = 0.0, saturation = 0.0, brightness = 0.0 }
        var bins = Array(repeating: Bin(), count: hueBins)

        for pixel in pixels {
            let (hue, saturation, brightness) = hsb(pixel.r, pixel.g, pixel.b)
            guard saturation >= minimumSaturation, brightness >= minimumBrightness else { continue }
            let weight = saturation * brightness
            let index = min(Int(hue * Double(hueBins)), hueBins - 1)
            // Hue is circular: average it as a direction, not a number.
            bins[index].weight += weight
            bins[index].x += cos(hue * 2 * .pi) * weight
            bins[index].y += sin(hue * 2 * .pi) * weight
            bins[index].saturation += saturation * weight
            bins[index].brightness += brightness * weight
        }

        var chosen: [Int] = []
        for index in bins.indices.sorted(by: { bins[$0].weight > bins[$1].weight }) {
            guard bins[index].weight > 0, chosen.count < count else { break }
            let separated = chosen.allSatisfy { other in
                let distance = abs(other - index)
                return min(distance, hueBins - distance) >= 2
            }
            if separated { chosen.append(index) }
        }

        return chosen.map { index in
            let bin = bins[index]
            var hue = atan2(bin.y, bin.x) / (2 * .pi)
            if hue < 0 { hue += 1 }
            return Swatch(hue: hue, saturation: bin.saturation / bin.weight, brightness: bin.brightness / bin.weight)
        }
    }

    static func hsb(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
        let maximum = max(r, g, b), minimum = min(r, g, b)
        let delta = maximum - minimum
        let saturation = maximum == 0 ? 0 : delta / maximum
        guard delta > 0 else { return (0, saturation, maximum) }
        var hue: Double
        if maximum == r {
            hue = (g - b) / delta
        } else if maximum == g {
            hue = (b - r) / delta + 2
        } else {
            hue = (r - g) / delta + 4
        }
        hue /= 6
        if hue < 0 { hue += 1 }
        return (hue, saturation, maximum)
    }

    /// The image redrawn at `side`×`side`, as 0–1 RGB.
    static func pixels(of image: UIImage, side: Int) -> [(r: Double, g: Double, b: Double)]? {
        guard let cgImage = image.cgImage else { return nil }
        var bytes = [UInt8](repeating: 0, count: side * side * 4)
        let drawn: Bool = bytes.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(
                data: buffer.baseAddress, width: side, height: side,
                bitsPerComponent: 8, bytesPerRow: side * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return false }
            context.interpolationQuality = .medium
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
            return true
        }
        guard drawn else { return nil }
        return stride(from: 0, to: bytes.count, by: 4).map { offset in
            (Double(bytes[offset]) / 255, Double(bytes[offset + 1]) / 255, Double(bytes[offset + 2]) / 255)
        }
    }
}

extension PrismAccent {
    /// The category's own colour as a swatch, for covers with none.
    var swatch: CoverPalette.Swatch {
        let resolved = UIColor(tone.main)
        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0
        resolved.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: nil)
        return CoverPalette.Swatch(hue: hue, saturation: saturation, brightness: brightness)
    }
}
