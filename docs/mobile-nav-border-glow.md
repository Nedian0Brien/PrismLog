# Mobile Nav Border Glow

## Goal

PrismLog mobile bottom navigation uses a localized border glow that follows the active indicator.

The effect should:

- tint only the rounded border area of `nav.mobile-floating-nav`
- follow the active tab without pointer tracking
- remain compatible with iOS Safari

## Core Idea

Instead of tracking the mouse, the glow uses the indicator position.

1. Measure the active button inside `MobileFloatingNav.jsx`
2. Compute the indicator width and x offset
3. Expose the indicator center as `--mobile-nav-glow-x`
4. Render a full-size overlay layer above the nav shell
5. Fill that layer with a `radial-gradient(...) at var(--mobile-nav-glow-x)`
6. Hollow out the center with `-webkit-mask-composite: xor` / `mask-composite: exclude`
7. Leave only the rounded border ring visible

## Why This Works

- The glow source is stable because it is driven by tab state, not pointer events.
- The border shape stays aligned because the overlay uses `inset: 0` and `border-radius: inherit`.
- The mask is applied to a dedicated glow layer, not the glass background layer.
- Safari support is more predictable than the earlier SVG/filter approach because the glass effect and the border effect are separated.

## Key Files

- `src/components/MobileFloatingNav.jsx`
- `src/styles/mobile-floating-nav.css`

## Important CSS

```css
.mobile-floating-nav__border-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    10rem circle at var(--mobile-nav-glow-x) 50%,
    color-mix(in srgb, var(--mobile-nav-accent) 72%, rgba(255, 255, 255, 0.08)) 0%,
    color-mix(in srgb, var(--mobile-nav-accent) 42%, transparent) 37%,
    transparent 80%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

## Notes

- `light-pool` is separate from `border-glow`. It tints the local glass area, while `border-glow` only affects the ring.
- If mask support is missing, the safest fallback is to hide the border glow layer and keep only the base glass + indicator.
- Keep the glow radius close to the indicator. If it becomes too wide, the nav starts looking globally tinted instead of locally reflective.
