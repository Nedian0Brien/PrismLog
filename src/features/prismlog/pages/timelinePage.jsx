import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLORS,
  ClockIcon,
  CalendarIcon,
  clamp,
  safeNumber,
  getDateKey,
  DAYS_KO,
} from "../core";
import { Badge, GlassCard, StatusBadge } from "../ui";
import { groupLogsByDate } from "../mappers";

export const TimelinePage = ({ logs, loading, layout, onOpenDetail }) => {
  const [view, setView] = useState("feed");
  const [visibleKeys, setVisibleKeys] = useState({});
  const itemRefs = useRef({});

  // mappers.js의 로직을 사용하여 그룹화
  const groups = useMemo(() => groupLogsByDate(logs), [logs]);

  useEffect(() => {
    setVisibleKeys({});
  }, [logs, view]);

  useEffect(() => {
    if (view !== "feed") return undefined;
    if (typeof window === "undefined") return undefined;
    
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = entry.target.getAttribute("data-item-key");
        if (!key) return;
        setVisibleKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      });
    }, { threshold: 0.24, rootMargin: "0px 0px -8% 0px" });

    groups.forEach((group) => {
      group.items.forEach((item) => {
        const node = itemRefs.current[item.id];
        if (node) observer.observe(node);
      });
    });
    return () => observer.disconnect();
  }, [groups, view]);

  const renderProgressSection = (item, visible) => {
    if (item.progress === null) {
      return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted }}>{item.summary || "기록 메모 없음"}</p>;
    }

    const progressValue = item.progressEnd ?? item.progress ?? 0;
    const progressStart = clamp(safeNumber(item.progressStart, progressValue), 0, 100);
    const progressDelta = Math.max(0, progressValue - progressStart);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: -2 }}>
          <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{item.summary}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: item.accent, fontFamily: "'Outfit', sans-serif" }}>{`${progressValue}%`}</span>
        </div>
        <div style={{ position: "relative", height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ 
            position: "absolute", left: 0, top: 0, bottom: 0, 
            width: `${visible ? progressStart : 0}%`, 
            background: item.accent, opacity: 0.4,
            transition: "width 0.6s cubic-bezier(.16,1,.3,1)" 
          }} />
          {progressDelta > 0 && (
            <div style={{ 
              position: "absolute", left: `${progressStart}%`, top: 0, bottom: 0, 
              width: `${visible ? progressDelta : 0}%`, 
              background: item.accent,
              boxShadow: `0 0 12px ${item.accent}66`,
              transition: "width 0.6s cubic-bezier(.16,1,.3,1)",
              transitionDelay: "0.4s"
            }} />
          )}
        </div>
      </div>
    );
  };

  const calendarMonths = useMemo(() => {
    const counts = logs.reduce((acc, log) => {
      const key = getDateKey(log.occurred_at || log.created_at);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const uniqueMonthKeys = [...new Set(logs.map((log) => {
      const date = new Date(log.occurred_at || log.created_at);
      if (Number.isNaN(date.getTime())) return "";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }).filter(Boolean))];

    const monthKeys = uniqueMonthKeys.length > 0
      ? uniqueMonthKeys.sort((a, b) => b.localeCompare(a)).slice(0, 3)
      : [`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`];

    return monthKeys.map((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const first = new Date(year, month - 1, 1);
      const firstWeekday = (first.getDay() + 6) % 7;
      const lastDate = new Date(year, month, 0).getDate();
      const cells = [];
      for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
      for (let day = 1; day <= lastDate; day += 1) {
        const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        cells.push({ day, count: counts[key] || 0 });
      }
      while (cells.length % 7 !== 0) cells.push(null);
      return { key: monthKey, label: `${year}년 ${month}월`, cells };
    });
  }, [logs]);

  const viewTabs = [
    { key: "feed", label: "시간순 피드", icon: <ClockIcon size={16} /> },
    { key: "calendar", label: "캘린더", icon: <CalendarIcon size={16} /> },
  ];
  const lineLeft = layout.isPhone ? 17 : 118;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: layout.isPhone ? "column" : "row", justifyContent: "space-between", alignItems: layout.isPhone ? "flex-start" : "flex-end", gap: 10 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Timeline</p>
          <h2 style={{ margin: 0, fontSize: layout.isPhone ? 24 : 30, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>타임라인</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                minHeight: 44, padding: "0 14px", borderRadius: 999,
                border: `1px solid ${view === tab.key ? `${COLORS.reading.main}66` : COLORS.dark.border}`,
                background: view === tab.key ? `${COLORS.reading.main}16` : "rgba(255,255,255,0.03)",
                color: view === tab.key ? COLORS.reading.main : COLORS.dark.textMuted,
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <GlassCard><p style={{ color: COLORS.dark.textMuted }}>불러오는 중...</p></GlassCard>
      ) : view === "feed" ? (
        <div style={{ position: "relative", paddingLeft: layout.isPhone ? 0 : 8 }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: lineLeft, width: 2, background: "rgba(255,255,255,0.05)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {groups.map((group) => (
              <div key={group.key} style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "100px 1fr", gap: 20, paddingLeft: layout.isPhone ? 38 : 0 }}>
                <div style={{ position: "absolute", left: layout.isPhone ? 11 : lineLeft - 6, width: 12, height: 12, borderRadius: "50%", background: "#f5f0eb", border: `2px solid ${COLORS.dark.bg}`, zIndex: 1, marginTop: 22 }} />
                {!layout.isPhone && (
                  <div style={{ textAlign: "right", paddingTop: 18 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.dark.text, lineHeight: 1 }}>{group.dayNumber}</div>
                    <div style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{group.sideLabel}</div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {group.items.map((item) => {
                    const visible = visibleKeys[item.id] ?? false;
                    return (
                      <button
                        key={item.id}
                        ref={(node) => { itemRefs.current[item.id] = node; }}
                        data-item-key={item.id}
                        onClick={() => onOpenDetail?.({ id: item.id })}
                        style={{
                          width: "100%", textAlign: "left", padding: "16px", borderRadius: 22,
                          background: `linear-gradient(180deg, rgba(255,255,255,0.04), ${item.accent}08)`,
                          border: `1px solid ${item.accent}22`, color: COLORS.dark.text, cursor: "pointer",
                          opacity: visible ? 1 : 0.3, transform: visible ? "translateY(0)" : "translateY(10px)",
                          transition: "all 0.5s ease-out"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Badge text={item.categoryLabel} color={item.accent} />
                            {item.status && <StatusBadge status={item.status} />}
                          </div>
                          <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{item.time}</span>
                        </div>
                        
                        <div style={{ display: "flex", gap: 14 }}>
                          {item.poster && <img src={item.poster} alt="" style={{ width: 50, height: 70, borderRadius: 8, objectFit: "cover" }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>{item.title}</h4>
                            {renderProgressSection(item, visible)}
                            {item.snippet && <p style={{ margin: "8px 0 0", fontSize: 13, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.snippet}</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: COLORS.dark.textMuted }}>캘린더 뷰는 준비 중입니다.</p>
      )}
    </div>
  );
};
