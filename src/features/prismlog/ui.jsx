import { useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  COLORS,
  CATEGORY_KEYS,
  CATEGORY_META,
  clamp,
  safeNumber,
  BookIcon,
  PenIcon,
  FilmIcon,
  StarIcon,
  XIcon,
} from "./core";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export const HalfDonutChart = ({ value, size = 72, strokeWidth = 7, color, bg = "rgba(255,255,255,0.06)" }) => {
  const safeValue = clamp(safeNumber(value), 0, 100);
  const r = (size - strokeWidth) / 2;
  const arcLength = Math.PI * r;
  const dash = (safeValue / 100) * arcLength;
  const cx = size / 2;
  const cy = size / 2;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const viewHeight = size / 2 + strokeWidth;
  return (
    <svg width={size} height={viewHeight} viewBox={`0 0 ${size} ${viewHeight}`} style={{ display: "block", overflow: "visible" }}>
      <path d={arcPath} fill="none" stroke={bg} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path
        d={arcPath}
        fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${Math.max(arcLength - dash, 0)}`}
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
};

/* ──────────── Utility Components ──────────── */
export const GlassCard = ({ children, style = {}, className = "", onClick, glow }) => (
  <div
    onClick={onClick}
    className={className}
    style={{
      background: COLORS.dark.card,
      backdropFilter: COLORS.dark.glassBlur,
      WebkitBackdropFilter: COLORS.dark.glassBlur,
      border: `1px solid ${COLORS.dark.border}`,
      borderRadius: 20,
      padding: "20px",
      position: "relative",
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
      ...style,
    }}
  >
    {glow && (
      <div style={{
        position: "absolute", top: -40, right: -40, width: 120, height: 120,
        background: glow, borderRadius: "50%", filter: "blur(50px)", opacity: 0.5, pointerEvents: "none",
      }} />
    )}
    {children}
  </div>
);

export const ProgressBar = ({ value, color, height = 6 }) => (
  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: height, height, width: "100%", overflow: "hidden" }}>
    <div style={{
      width: `${value}%`, height: "100%", borderRadius: height,
      background: `linear-gradient(90deg, ${color}, ${color}aa)`,
      transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
      boxShadow: `0 0 12px ${color}55`,
    }} />
  </div>
);

export const IconActionButton = ({ onClick, label = "수정" }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    style={{
      width: 28,
      height: 28,
      borderRadius: 10,
      border: `1px solid ${COLORS.dark.border}`,
      background: "rgba(255,255,255,0.05)",
      color: COLORS.dark.textMuted,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
    }}
  >
    <PenIcon size={14} color={COLORS.dark.textMuted} />
  </button>
);

export const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-block", padding: "3px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    background: `${color}22`, color: color, border: `1px solid ${color}33`,
  }}>{text}</span>
);

export const StatusBadge = ({ status }) => {
  const map = {
    "시청 중": { bg: `${COLORS.reading.main}22`, color: COLORS.reading.main, border: `${COLORS.reading.main}33` },
    "플레이 중": { bg: `${COLORS.reading.main}22`, color: COLORS.reading.main, border: `${COLORS.reading.main}33` },
    "시청 완료": { bg: `${COLORS.study.main}22`, color: COLORS.study.main, border: `${COLORS.study.main}33` },
    "플레이 완료": { bg: `${COLORS.study.main}22`, color: COLORS.study.main, border: `${COLORS.study.main}33` },
    "기대 중": { bg: `${COLORS.movie.main}22`, color: COLORS.movie.main, border: `${COLORS.movie.main}33` },
    "중도 하차": { bg: "#a0989022", color: "#a09890", border: "#a0989033" },
  };
  const s = map[status] || map["중도 하차"];
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>;
};

export const RatingStars = ({ rating, size = 14 }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} size={size} filled={i <= rating} />)}
  </div>
);

/* ──────────── Spectrum Ring Chart ──────────── */
export const SpectrumRing = ({ reading = 35, study = 40, culture = 25 }) => {
  const total = reading + study + culture || 1;
  const r = 70, cx = 90, cy = 90, stroke = 14;
  const circ = 2 * Math.PI * r;
  const seg = [
    { pct: reading / total, color: COLORS.reading.main },
    { pct: study / total, color: COLORS.study.main },
    { pct: culture / total, color: COLORS.culture.main },
  ];
  let offset = 0;
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <defs>
        {seg.map((s, i) => (
          <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={s.color} />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.6" />
          </linearGradient>
        ))}
        <filter id="ring-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {seg.map((s, i) => {
        const dashLen = circ * s.pct;
        const dashOff = circ * offset;
        offset += s.pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={`url(#grad-${i})`}
            strokeWidth={stroke} strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={-dashOff} strokeLinecap="round" filter="url(#ring-glow)"
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "all 1s ease" }}
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={COLORS.dark.text} fontSize="22" fontWeight="700" fontFamily="'Outfit', sans-serif">
        {reading + study + culture}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={COLORS.dark.textMuted} fontSize="11" fontFamily="'Outfit', sans-serif">
        전체 기록
      </text>
    </svg>
  );
};

/* ──────────── Heatmap ──────────── */
export const Heatmap = ({ matrix = Array.from({ length: 5 }, () => Array(7).fill(0)) }) => {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const getColor = (v) => {
    if (v === null) return "transparent";
    if (v === 0) return "rgba(255,255,255,0.04)";
    const colors = ["", "rgba(45,181,163,0.3)", "rgba(240,201,48,0.45)", "rgba(230,57,70,0.5)"];
    return colors[v] || colors[3];
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {days.map(d => <div key={d} style={{ width: 28, textAlign: "center", fontSize: 10, color: COLORS.dark.textMuted }}>{d}</div>)}
      </div>
      {matrix.map((week, wi) => (
        <div key={wi} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
          {week.map((v, di) => (
            <div key={di} style={{
              width: 28, height: 28, borderRadius: 6, background: getColor(v),
              border: v !== null ? "1px solid rgba(255,255,255,0.04)" : "none",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CategoryToggleChips = ({ enabled, onToggle }) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {CATEGORY_KEYS.map((key) => {
      const active = Boolean(enabled[key]);
      const color = CATEGORY_META[key].color;
      return (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            border: `1px solid ${active ? `${color}88` : COLORS.dark.border}`,
            background: active ? `${color}20` : "rgba(255,255,255,0.04)",
            color: active ? color : COLORS.dark.textMuted,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Pretendard', sans-serif",
          }}
        >
          {CATEGORY_META[key].label}
        </button>
      );
    })}
  </div>
);

export const TrendLineChart = ({ series, enabled }) => {
  const activeKeys = CATEGORY_KEYS.filter((key) => enabled[key]);
  if (activeKeys.length === 0) {
    return <p className="m-0 text-xs text-[#a09890]">표시할 카테고리를 선택해 주세요.</p>;
  }

  const labels = series.map((d) => d.label);
  const datasets = activeKeys.map((key) => ({
    label: CATEGORY_META[key].label,
    data: series.map((d) => d[key]),
    borderColor: CATEGORY_META[key].color,
    backgroundColor: `${CATEGORY_META[key].color}33`,
    pointRadius: 2.5,
    pointHoverRadius: 4,
    borderWidth: 2.2,
    tension: 0,
    fill: false,
  }));

  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top", labels: { color: "#a09890", boxWidth: 10, boxHeight: 10 } },
      tooltip: {
        backgroundColor: "rgba(20,20,20,0.92)",
        titleColor: "#f5f0eb",
        bodyColor: "#f5f0eb",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#a09890", maxRotation: 0, autoSkip: true, autoSkipPadding: 16, font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#a09890", precision: 0, font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
    },
  };

  return (
    <div className="w-full">
      <div className="h-56 w-full rounded-2xl border border-white/10 bg-black/10 p-3">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export const DistributionBarChart = ({ counts, enabled }) => {
  const activeKeys = CATEGORY_KEYS.filter((key) => enabled[key]);
  if (activeKeys.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>표시할 카테고리를 선택해 주세요.</p>;
  }
  const maxValue = Math.max(1, ...activeKeys.map((key) => counts[key] || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {activeKeys.map((key) => {
        const value = counts[key] || 0;
        const color = CATEGORY_META[key].color;
        const widthPct = (value / maxValue) * 100;
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{CATEGORY_META[key].label}</span>
              <span style={{ fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{value}</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                width: `${widthPct}%`,
                height: "100%",
                borderRadius: 999,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                boxShadow: `0 0 10px ${color}44`,
                transition: "width 0.35s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ──────────── Bottom Sheet ──────────── */
export const BottomSheet = ({ open, onClose, children, title, layout }) => {
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBody = {
      overflow: bodyStyle.overflow,
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
    };
    const previousHtmlOverflow = htmlStyle.overflow;

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBody.overflow;
      bodyStyle.position = previousBody.position;
      bodyStyle.top = previousBody.top;
      bodyStyle.left = previousBody.left;
      bodyStyle.right = previousBody.right;
      bodyStyle.width = previousBody.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open || layout?.isTabletUp || !contentRef.current || typeof window === "undefined") return undefined;

    const scrollFocusedFieldIntoView = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!contentRef.current?.contains(target)) return;

      const isFormField = target.matches("input, textarea, select");
      if (!isFormField) return;

      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const container = contentRef.current;
          if (!container) return;

          const targetRect = target.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const keyboardInset = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset-height")
          ) || 0;
          const visibleTop = containerRect.top + 12;
          const visibleBottom = containerRect.bottom - keyboardInset - 20;

          if (targetRect.bottom > visibleBottom) {
            container.scrollBy({ top: targetRect.bottom - visibleBottom, behavior: "auto" });
            return;
          }
          if (targetRect.top < visibleTop) {
            container.scrollBy({ top: targetRect.top - visibleTop, behavior: "auto" });
          }
        }, 180);
      });
    };

    document.addEventListener("focusin", scrollFocusedFieldIntoView);
    return () => {
      document.removeEventListener("focusin", scrollFocusedFieldIntoView);
    };
  }, [layout?.isTabletUp, open]);

  if (!open) return null;
  const isWide = layout?.isTabletUp;
  // --app-vh: 키보드가 올라와도 변하지 않는 최대 뷰포트 높이
  const sheetMaxHeight = isWide
    ? "min(85vh, calc(var(--app-vh) - 48px))"
    : "calc(var(--app-vh) - max(var(--safe-area-top), var(--safe-area-max-top)) - 8px)";
  const sheetContentMaxHeight = isWide
    ? "calc(min(85vh, calc(var(--app-vh) - 48px)) - 24px)"
    : "calc(var(--app-vh) - max(var(--safe-area-top), var(--safe-area-max-top)) - 48px)";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, display: "flex",
      alignItems: isWide ? "center" : "flex-end", justifyContent: "center",
      padding: isWide ? "24px" : `0 var(--safe-area-right) 0 var(--safe-area-left)`,
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: isWide ? (layout?.isDesktop ? 760 : 680) : 480, maxHeight: sheetMaxHeight,
        background: COLORS.dark.surfaceSolid, borderRadius: isWide ? 24 : "24px 24px 0 0",
        padding: "8px 0 0", overflow: "hidden",
        animation: "slideUp 0.35s cubic-bezier(.32,.72,.24,1)",
      }}>
        {!isWide && <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />}
        <div
          ref={contentRef}
          style={{
            padding: isWide ? "12px 28px calc(32px + var(--viewport-safe-bottom))" : "0 24px calc(32px + var(--safe-area-bottom-base))",
            overflowY: "auto",
            maxHeight: sheetContentMaxHeight,
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            scrollPaddingBottom: "calc(24px + var(--keyboard-inset-height))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", margin: 0 }}>{title}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XIcon color={COLORS.dark.textMuted} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ──────────── Category Selector in BottomSheet ──────────── */
export const CategorySelector = ({ selected, onSelect, layout }) => {
  const cats = [
    { key: "reading", label: "독서", icon: <BookIcon size={22} />, color: COLORS.reading.main },
    { key: "study", label: "공부", icon: <PenIcon size={22} />, color: COLORS.study.main },
    { key: "culture", label: "문화", icon: <FilmIcon size={22} />, color: COLORS.culture.main },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 24 }}>
      {cats.map(c => (
        <button key={c.key} onClick={() => onSelect(c.key)} style={{
          width: "100%",
          minHeight: layout?.isPhone ? 78 : 88,
          padding: layout?.isPhone ? "12px 6px" : "14px 8px",
          borderRadius: 16, border: `1.5px solid ${selected === c.key ? c.color : COLORS.dark.border}`,
          background: selected === c.key ? `${c.color}15` : "transparent", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          transition: "all 0.25s",
        }}>
          <span style={{ color: selected === c.key ? c.color : COLORS.dark.textMuted }}>{c.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: selected === c.key ? c.color : COLORS.dark.textMuted }}>{c.label}</span>
        </button>
      ))}
    </div>
  );
};
