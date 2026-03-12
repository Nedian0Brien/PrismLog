import { useEffect, useMemo, useRef, useState } from "react";

export default function MobileFloatingNav({ items, activeKey, onChange, contained = false }) {
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const compactRef = useRef(false);
  const scrollRafRef = useRef(null);

  const activeItem = useMemo(
    () => items.find((item) => item.key === activeKey) || items[0] || null,
    [activeKey, items]
  );
  const activeIndex = useMemo(
    () => {
      const foundIndex = items.findIndex((item) => item.key === activeKey);
      return foundIndex >= 0 ? foundIndex : 0;
    },
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

  if (!activeItem) return null;

  return (
    <nav
      className={`mobile-floating-nav${contained ? " mobile-floating-nav-contained" : ""}${compact ? " mobile-floating-nav-compact" : ""}`}
      style={{
        "--mobile-nav-accent": activeItem.color || "#f5f0eb",
        "--mobile-nav-count": items.length,
        "--mobile-nav-index": activeIndex,
      }}
      aria-label="모바일 하단 내비게이션"
    >
      <span className="mobile-floating-nav__light-pool" aria-hidden="true" />
      <span
        className="mobile-floating-nav__border-glow"
        aria-hidden="true"
      />
      <span
        className="mobile-floating-nav__indicator"
        aria-hidden="true"
      />
      {items.map((item) => {
        const Icon = item.Icon;
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
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
