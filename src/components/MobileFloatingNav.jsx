import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export default function MobileFloatingNav({ items, activeKey, onChange, contained = false }) {
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, x: 0, ready: false });
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const compactRef = useRef(false);
  const scrollRafRef = useRef(null);
  const navPadding = compact ? 2 : 4;

  const activeItem = useMemo(
    () => items.find((item) => item.key === activeKey) || items[0] || null,
    [activeKey, items]
  );

  useEffect(() => {
    const readScrollY = () => Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);

    const updateCompact = (nextCompact) => {
      if (compactRef.current === nextCompact) return;
      compactRef.current = nextCompact;
      setCompact(nextCompact);
    };

    lastScrollYRef.current = readScrollY();

    const flushScrollState = () => {
      const currentY = readScrollY();
      const delta = currentY - lastScrollYRef.current;
      const movementThreshold = 8;

      if (currentY < 32) {
        updateCompact(false);
      } else if (delta > movementThreshold && currentY > 72) {
        updateCompact(true);
      } else if (delta < -movementThreshold) {
        updateCompact(false);
      }

      lastScrollYRef.current = currentY;
      scrollRafRef.current = null;
    };

    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(flushScrollState);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

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
  }, [activeKey, navPadding]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const activeButton = tabRefs.current[activeKey];
    if (!nav || !activeButton) return undefined;

    let frameId = null;
    const scheduleSync = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncIndicator();
      });
    };

    scheduleSync();

    const handleViewportChange = () => {
      scheduleSync();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleSync();
      });
      resizeObserver.observe(nav);
      resizeObserver.observe(activeButton);
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      resizeObserver?.disconnect();
    };
  }, [activeKey, compact, syncIndicator]);

  if (!activeItem) return null;

  return (
    <nav
      className={`mobile-floating-nav${contained ? " mobile-floating-nav-contained" : ""}${compact ? " mobile-floating-nav-compact" : ""}`}
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
          width: `${Math.max(indicatorStyle.width + (compact ? 14 : 22), compact ? 58 : 80)}px`,
          transform: `translateX(${Math.max(indicatorStyle.x - (compact ? 7 : 11), compact ? -2 : -4)}px)`,
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
