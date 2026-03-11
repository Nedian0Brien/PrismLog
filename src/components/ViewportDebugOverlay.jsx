import { useEffect, useMemo, useState } from "react";

const readViewportDebugMetrics = () => {
  const rootStyle = window.getComputedStyle(document.documentElement);
  const viewport = window.visualViewport;

  return {
    appVh: rootStyle.getPropertyValue("--app-vh").trim() || "-",
    visualVh: rootStyle.getPropertyValue("--visual-viewport-height").trim() || "-",
    keyboardInset: rootStyle.getPropertyValue("--keyboard-inset-height").trim() || "-",
    safeBottom: rootStyle.getPropertyValue("--safe-area-bottom-effective").trim() || "-",
    safeTop: rootStyle.getPropertyValue("--viewport-safe-top").trim() || "-",
    innerHeight: `${Math.round(window.innerHeight)}px`,
    viewportHeight: viewport ? `${Math.round(viewport.height)}px` : "-",
    viewportTop: viewport ? `${Math.round(viewport.offsetTop)}px` : "-",
    keyboardOpen: document.documentElement.dataset.keyboardOpen === "true" ? "yes" : "no",
  };
};

export default function ViewportDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const params = new URLSearchParams(window.location.search);
    const shouldEnable = params.get("debugViewport") === "1" || window.localStorage.getItem("prismlog-debug-viewport") === "1";
    if (!shouldEnable) return undefined;

    setEnabled(true);

    const update = () => {
      setMetrics(readViewportDebugMetrics());
    };

    update();

    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update, { passive: true });
    window.visualViewport?.addEventListener("scroll", update, { passive: true });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  const rows = useMemo(() => {
    if (!metrics) return [];
    return [
      ["app-vh", metrics.appVh],
      ["visual-vh", metrics.visualVh],
      ["keyboard", metrics.keyboardInset],
      ["safe-bottom", metrics.safeBottom],
      ["safe-top", metrics.safeTop],
      ["innerHeight", metrics.innerHeight],
      ["vv.height", metrics.viewportHeight],
      ["vv.top", metrics.viewportTop],
      ["keyboard?", metrics.keyboardOpen],
    ];
  }, [metrics]);

  if (!enabled) return null;

  return (
    <aside
      style={{
        position: "fixed",
        top: "calc(8px + var(--viewport-safe-top))",
        right: "calc(8px + var(--safe-area-right))",
        zIndex: 260,
        width: collapsed ? 64 : 188,
        padding: collapsed ? "8px" : "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(14,12,11,0.88)",
        color: "#f5f0eb",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 14px 28px rgba(0,0,0,0.28)",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        style={{
          width: "100%",
          marginBottom: collapsed ? 0 : 8,
          padding: 0,
          border: "none",
          background: "transparent",
          color: "#f5f0eb",
          font: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        VP{collapsed ? "" : " DEBUG"}
      </button>
      {!collapsed && rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "rgba(245,240,235,0.64)" }}>{label}</span>
          <strong style={{ fontWeight: 700 }}>{value}</strong>
        </div>
      ))}
    </aside>
  );
}
