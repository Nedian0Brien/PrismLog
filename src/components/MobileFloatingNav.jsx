import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function MobileFloatingNav({ items, activeKey, onChange, contained = false }) {
  const navPadding = 6;
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, x: 0, ready: false });

  const activeItem = useMemo(
    () => items.find((item) => item.key === activeKey) || items[0] || null,
    [activeKey, items]
  );

  const syncIndicator = useCallback(() => {
    const nav = navRef.current;
    const activeButton = tabRefs.current[activeKey];
    if (!nav || !activeButton) return;

    const navRect = nav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const width = Math.round(buttonRect.width);
    const x = Math.round(buttonRect.left - navRect.left - navPadding);

    setIndicatorStyle((prev) => {
      if (prev.ready && prev.width === width && prev.x === x) return prev;
      return { width, x, ready: true };
    });
  }, [activeKey]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(syncIndicator);

    const handleViewportChange = () => {
      window.requestAnimationFrame(syncIndicator);
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [syncIndicator]);

  if (!activeItem) return null;

  return (
    <nav
      className={`mobile-floating-nav${contained ? " mobile-floating-nav-contained" : ""}`}
      ref={navRef}
      style={{
        "--mobile-nav-accent": activeItem.color || "#f5f0eb",
        "--mobile-nav-glow-x": indicatorStyle.ready
          ? `${indicatorStyle.x + navPadding + indicatorStyle.width / 2}px`
          : "50%",
      }}
      aria-label="모바일 하단 내비게이션"
    >
      <span
        className="mobile-floating-nav__light-pool"
        aria-hidden="true"
        style={{
          width: `${Math.max(indicatorStyle.width + 28, 92)}px`,
          transform: `translateX(${Math.max(indicatorStyle.x - 14, -6)}px)`,
          opacity: indicatorStyle.ready ? 1 : 0,
        }}
      />
      <span
        className="mobile-floating-nav__border-glow"
        aria-hidden="true"
        style={{ opacity: indicatorStyle.ready ? 1 : 0 }}
      />
      <span
        className="mobile-floating-nav__indicator"
        aria-hidden="true"
        style={{
          width: `${indicatorStyle.width}px`,
          transform: `translateX(${indicatorStyle.x}px)`,
          opacity: indicatorStyle.ready ? 1 : 0,
        }}
      />
      {items.map((item) => {
        const Icon = item.Icon;
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            ref={(element) => {
              tabRefs.current[item.key] = element;
            }}
            className={`mobile-floating-nav__item${isActive ? " is-active" : ""}`}
            onClick={() => onChange(item.key)}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} color="currentColor" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
