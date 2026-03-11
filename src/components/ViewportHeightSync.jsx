import { useEffect } from "react";

export default function ViewportHeightSync() {
  useEffect(() => {
    const root = document.documentElement;
    let maxViewportHeight = window.visualViewport?.height ?? window.innerHeight;
    let lastInnerWidth = window.innerWidth;

    const updateViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
      const innerWidth = window.innerWidth;
      const orientationChanged = Math.abs(innerWidth - lastInnerWidth) > 120;

      if (orientationChanged) {
        maxViewportHeight = height;
        lastInnerWidth = innerWidth;
      }
      if (height > maxViewportHeight) {
        maxViewportHeight = height;
      }

      const keyboardDelta = Math.max(0, maxViewportHeight - height - viewportOffsetTop);
      const keyboardOpen = keyboardDelta > 120;
      const keyboardInsetHeight = keyboardOpen ? keyboardDelta : 0;
      const appViewportHeight = maxViewportHeight;

      root.style.setProperty("--vh", `${height * 0.01}px`);
      root.style.setProperty("--app-vh", `${Math.round(appViewportHeight)}px`);
      root.style.setProperty("--viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--visual-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--viewport-offset-top", `${Math.round(viewportOffsetTop)}px`);
      root.style.setProperty("--viewport-offset-bottom", "0px");
      root.style.setProperty("--keyboard-inset-height", `${Math.round(keyboardInsetHeight)}px`);
      root.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
    };

    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight, { passive: true });
    window.addEventListener("orientationchange", updateViewportHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", updateViewportHeight, { passive: true });
    window.visualViewport?.addEventListener("scroll", updateViewportHeight, { passive: true });

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return null;
}
