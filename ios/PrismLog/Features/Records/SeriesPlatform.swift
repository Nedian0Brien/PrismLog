import SwiftUI

/// Where a series streams, as the web keys it (`SERIES_PLATFORM_OPTIONS`,
/// `core.jsx:210`), with each service's colour (`SERIES_PLATFORM_THEMES`)
/// and app icon (`public/platforms`).
enum SeriesPlatformOption: String, CaseIterable, Identifiable {
    case netflix
    case appleTVPlus = "apple_tv_plus"
    case disneyPlus = "disney_plus"
    case tv
    case other

    var id: String { rawValue }
    /// What the web stores in `platform_key`.
    var key: String { rawValue }

    var label: String {
        switch self {
        case .netflix: "넷플릭스"
        case .appleTVPlus: "애플티비+"
        case .disneyPlus: "디즈니 플러스"
        case .tv: "TV"
        case .other: "기타"
        }
    }

    var logo: String? {
        switch self {
        case .netflix: "PlatformNetflix"
        case .appleTVPlus: "PlatformAppleTVPlus"
        case .disneyPlus: "PlatformDisneyPlus"
        case .tv, .other: nil
        }
    }

    var symbol: String {
        self == .other ? "tag" : "tv"
    }

    var accent: Color {
        switch self {
        case .netflix: Color(hex: 0xE50914)
        case .appleTVPlus: Color(hex: 0xF5F0EB)
        case .disneyPlus: Color(hex: 0x6DB3FF)
        case .tv: Color(hex: 0xF0C75E)
        case .other: Color(hex: 0x9AD0C1)
        }
    }

    /// The web's `getSeriesPlatformLabel`: a service's own name, or the
    /// typed one for 기타.
    static func label(key: String, custom: String) -> String {
        let typed = custom.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let option = SeriesPlatformOption(rawValue: key) else { return typed.isEmpty ? key : typed }
        if option == .other { return typed.isEmpty ? option.label : typed }
        return option.label
    }

    /// The platform a record names: its `platform_key`, or — for records the
    /// iOS add sheet saved before it kept the key — a label that is one of
    /// the services' names.
    static func of(_ record: RecordItem) -> SeriesPlatformOption? {
        if let key = record.payload.string("platform_key"), let option = SeriesPlatformOption(rawValue: key) {
            return option
        }
        let label = (record.platformLabel ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !label.isEmpty else { return nil }
        return allCases.first { $0 != .other && $0.label == label } ?? .other
    }
}

/// A series' platform as a badge on its detail.
struct SeriesPlatform {
    let option: SeriesPlatformOption
    let label: String

    init?(record: RecordItem) {
        guard let option = SeriesPlatformOption.of(record) else { return nil }
        self.option = option
        self.label = option == .other
            ? SeriesPlatformOption.label(key: option.key, custom: record.platformLabel ?? "")
            : option.label
    }
}

struct SeriesPlatformIcon: View {
    let option: SeriesPlatformOption
    var size: CGFloat = 14

    var body: some View {
        if let logo = option.logo {
            Image(logo)
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(.rect(cornerRadius: size * 0.24, style: .continuous))
        } else {
            Image(systemName: option.symbol)
                .font(.system(size: size * 0.7, weight: .semibold))
                .foregroundStyle(option.accent)
                .frame(width: size, height: size)
        }
    }
}

struct SeriesPlatformBadge: View {
    let platform: SeriesPlatform

    var body: some View {
        HStack(spacing: 6) {
            SeriesPlatformIcon(option: platform.option)
            Text(platform.label)
                .font(PrismFont.text(10, .bold))
                .prismMuted()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background { Capsule().fill(platform.option.accent.opacity(0.14)) }
        .overlay { Capsule().strokeBorder(platform.option.accent.opacity(0.28)) }
    }
}

/// The web's "시청 플랫폼" picker (`newLogForm.jsx:1437`): a card per
/// service, its icon large in the corner and its name at the foot, and a
/// name field when 기타 is picked.
struct SeriesPlatformPicker: View {
    @Binding var key: String
    @Binding var customLabel: String

    private let columns = [GridItem(.adaptive(minimum: 132), spacing: 8)]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("시청 플랫폼").font(.prismCaption).prismMuted()

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(SeriesPlatformOption.allCases) { option in
                    card(option)
                }
            }

            if key == SeriesPlatformOption.other.key {
                TextField("예: 왓챠", text: $customLabel)
                    .font(.prismBody)
                    .foregroundStyle(PrismColor.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.white.opacity(0.04), in: .rect(cornerRadius: 14, style: .continuous))
                    .accessibilityIdentifier("platform.custom")
            }
        }
    }

    private func card(_ option: SeriesPlatformOption) -> some View {
        let active = key == option.key
        return Button {
            withAnimation(PrismMotion.snappy) { key = option.key }
            PrismHaptics.selection()
        } label: {
            ZStack(alignment: .bottomTrailing) {
                LinearGradient(
                    colors: [option.accent.opacity(active ? 0.22 : 0.12), Color.white.opacity(active ? 0.04 : 0.03)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                SeriesPlatformIcon(option: option, size: 54)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(12)
                Text(option.label)
                    .font(PrismFont.text(12, .bold))
                    .foregroundStyle(active ? PrismColor.text : PrismColor.textMuted)
                    .padding(12)
            }
            .frame(minHeight: 104)
            .clipShape(.rect(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(option.accent.opacity(active ? 0.55 : 0.26), lineWidth: active ? 1.5 : 1)
            }
            .shadow(color: active ? option.accent.opacity(0.2) : .black.opacity(0.16), radius: active ? 17 : 12, y: 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(active ? .isSelected : [])
        .accessibilityIdentifier("platform.\(option.key)")
    }
}
