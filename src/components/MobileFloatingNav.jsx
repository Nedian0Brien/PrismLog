import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function MobileFloatingNav({ items, activeKey, onChange, scrollContainerRef = null, contained = false }) {
  const navPadding = 6;
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const hiddenRef = useRef(false);
  const scrollRafRef = useRef(null);
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, x: 0, ready: false });

  const activeItem = useMemo(
    () => items.find((item) => item.key === activeKey) || items[0] || null,
    [activeKey, items]
  );

  useEffect(() => {
    const getScrollContainer = () => scrollContainerRef?.current ?? null;
    const getScrollY = () => {
      const scrollContainer = getScrollContainer();
      if (scrollContainer) {
        return scrollContainer.scrollTop;
      }
      return Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);
    };

    const updateHidden = (nextHidden) => {
      if (hiddenRef.current === nextHidden) return;
      hiddenRef.current = nextHidden;
      setHidden(nextHidden);
    };

    lastScrollY.current = getScrollY();

    const updateVisibility = () => {
      const currentY = getScrollY();
      const delta = currentY - lastScrollY.current;
      const movementThreshold = 8;

      if (currentY < 32) {
        updateHidden(false);
      } else if (delta > movementThreshold && currentY > 72) {
        updateHidden(true);
      } else if (delta < -movementThreshold) {
        updateHidden(false);
      }

      lastScrollY.current = currentY;
      scrollRafRef.current = null;
    };

    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(updateVisibility);
    };

    const scrollContainer = getScrollContainer();
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", onScroll);
      } else {
        window.removeEventListener("scroll", onScroll);
      }
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [scrollContainerRef]);

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
      className={`mobile-floating-nav${contained ? " mobile-floating-nav-contained" : ""}${hidden ? " mobile-floating-nav-hidden" : ""}`}
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
