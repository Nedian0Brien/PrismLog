import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLORS,
  DAYS_KO,
  clamp,
  formatTimeLabel,
  getDateKey,
  normalizeEpisodeWatchDates,
  getSeriesProgressMetrics,
  safeNumber,
  normalizeCultureType,
  getCultureTone,
  ClockIcon,
  CalendarIcon,
} from "../core";
import { Badge, GlassCard, StatusBadge } from "../ui";

export const TimelinePage = ({ logs, loading, layout, onOpenDetail }) => {
  const [view, setView] = useState("feed");
  const [visibleKeys, setVisibleKeys] = useState({});
  const itemRefs = useRef({});

  const groups = useMemo(() => {
    const sorted = [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.reduce((acc, log) => {
      const key = getDateKey(log.created_at);
      if (!key) return acc;
      const payload = log.payload || {};
      const type = log.category === "culture" ? normalizeCultureType(payload.type) : log.category;
      const accent = log.category === "reading"
        ? COLORS.reading.main
        : log.category === "study"
          ? COLORS.study.main
          : getCultureTone(type).main;
      const readingSessions = Array.isArray(payload.reading_sessions)
        ? [...payload.reading_sessions].sort((a, b) => new Date(b.ended_at || b.date || 0) - new Date(a.ended_at || a.date || 0))
        : [];
      const latestReadingSession = readingSessions[0] || null;
      const readingNotes = Array.isArray(payload.reading_notes)
        ? [...payload.reading_notes].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        : [];
      const latestReadingNote = readingNotes[0] || null;
      const studyChapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const studyCompleted = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
      const studyProgress = studyChapters.length > 0 ? Math.round((studyCompleted / studyChapters.length) * 100) : clamp(safeNumber(payload.progress), 0, 100);
      const seriesMetrics = type === "시리즈"
        ? getSeriesProgressMetrics({
          episodeCount: payload.episode_count,
          seasons: payload.seasons,
          watchedEpisodes: payload.watched_episode_count,
          playtime: payload.playtime,
          progress: payload.progress,
        })
        : null;
      const seriesWatchDates = type === "시리즈" ? normalizeEpisodeWatchDates(payload.episode_watch_dates) : {};
      const watchedEpisodesToday = type === "시리즈"
        ? (seriesMetrics?.seasons || []).flatMap((season) => (
          season.episodes
            .filter((episode) => seriesWatchDates[`${season.seasonNumber}-${episode.episodeNumber}`]?.slice(0, 10) === key)
            .map((episode) => ({
              id: `${log.id}-${season.seasonNumber}-${episode.episodeNumber}`,
              title: episode.name || `EP ${episode.episodeNumber}`,
              code: `S${season.seasonNumber} · E${episode.episodeNumber}`,
              stillUrl: episode.stillUrl,
            }))
        ))
        : [];
      const progress = log.category === "reading"
        ? clamp(
          safeNumber(
            payload.progress,
            safeNumber(payload.pages_total || payload.pages) > 0
              ? Math.round((safeNumber(payload.pages_read || payload.readPages) / safeNumber(payload.pages_total || payload.pages)) * 100)
              : 0,
          ),
          0,
          100,
        )
        : log.category === "study"
          ? clamp(studyProgress, 0, 100)
          : type === "시리즈"
            ? clamp(safeNumber(seriesMetrics?.progress, payload.progress), 0, 100)
            : null;
      const progressStart = log.category === "reading"
        ? clamp(
          safeNumber(
            latestReadingSession?.from_progress ?? latestReadingSession?.fromProgress,
            Math.max(0, safeNumber(progress, 0) - safeNumber(latestReadingSession?.progress_delta ?? latestReadingSession?.progressDelta, 0)),
          ),
          0,
          100,
        )
        : progress;
      const progressEnd = progress ?? 0;
      const sectionKey = log.category === "reading"
        ? "reading"
        : log.category === "study"
          ? "study"
          : type === "시리즈"
            ? "series"
            : type === "게임"
              ? "game"
              : "movie";
      const item = {
        id: log.id,
        title: log.title,
        time: formatTimeLabel(log.created_at),
        accent,
        sectionKey,
        categoryLabel: log.category === "reading" ? "독서" : log.category === "study" ? "공부" : type,
        summary: log.summary || (log.category === "reading"
          ? `${safeNumber(payload.pages_read)} / ${safeNumber(payload.pages_total)}p`
          : log.category === "study"
            ? `${Array.isArray(payload.chapters) ? payload.chapters.length : 0}개 챕터`
            : payload.playtime || payload.status || ""),
        snippet: log.category === "reading" ? (latestReadingNote?.text || "") : "",
        progress,
        progressStart,
        progressEnd,
        watchedEpisodesToday,
        status: log.category === "culture" ? (payload.status || (type === "게임" ? "플레이 중" : "시청 중")) : "",
        poster: log.category === "reading"
          ? (payload.cover || null)
          : log.category === "study"
            ? (payload.image_url || payload.imageUrl || null)
            : (payload.poster || null),
      };
      const existing = acc.find((group) => group.key === key);
      if (existing) {
        existing.items.push(item);
      } else {
        const date = new Date(log.created_at);
        acc.push({
          key,
          date,
          dayNumber: String(date.getDate()).padStart(2, "0"),
          sideLabel: `${date.getMonth() + 1}월 · ${DAYS_KO[date.getDay()]}요일`,
          items: [item],
        });
      }
      return acc;
    }, []);
  }, [logs]);

  useEffect(() => {
    setVisibleKeys({});
  }, [logs, view]);

  useEffect(() => {
    if (view !== "feed") return undefined;
    if (typeof window === "undefined") return undefined;
    if (typeof window.IntersectionObserver === "undefined") {
      setVisibleKeys(groups.reduce((acc, group) => {
        group.items.forEach((item) => {
          acc[item.id] = true;
        });
        return acc;
      }, {}));
      return undefined;
    }
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

  const calendarMonths = useMemo(() => {
    const counts = logs.reduce((acc, log) => {
      const key = getDateKey(log.created_at);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const uniqueMonthKeys = [...new Set(logs.map((log) => {
      const date = new Date(log.created_at);
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {viewTabs.map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                style={{
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? `${COLORS.reading.main}66` : COLORS.dark.border}`,
                  background: active ? `${COLORS.reading.main}16` : "rgba(255,255,255,0.03)",
                  color: active ? COLORS.reading.main : COLORS.dark.textMuted,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontFamily: "'Pretendard', sans-serif",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <GlassCard>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>타임라인을 불러오는 중...</p>
        </GlassCard>
      ) : view === "feed" ? (
        <GlassCard style={{ padding: layout.isPhone ? "18px 14px 24px" : "26px 24px 30px", overflow: "visible" }}>
          <div style={{ position: "relative", paddingLeft: layout.isPhone ? 0 : 8 }}>
            <div style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: lineLeft,
              width: 2,
              borderRadius: 999,
              background: "linear-gradient(180deg, rgba(45,181,163,0.8), rgba(240,201,48,0.55), rgba(230,57,70,0.4))",
              boxShadow: "0 0 22px rgba(45,181,163,0.15)",
            }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {groups.map((group, index) => (
                <div
                  key={group.key}
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: layout.isPhone ? "1fr" : "88px minmax(0, 1fr)",
                    gap: layout.isPhone ? 10 : 20,
                    paddingLeft: layout.isPhone ? 38 : 0,
                    paddingBottom: index === groups.length - 1 ? 0 : 6,
                  }}
                >
                  <div style={{
                    position: "absolute",
                    left: layout.isPhone ? 11 : lineLeft - 7,
                    top: layout.isPhone ? 18 : 22,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #f5f0eb, #a09890)",
                    border: `2px solid ${COLORS.dark.bg}`,
                    boxShadow: "0 0 0 6px rgba(255,255,255,0.04), 0 0 18px rgba(245,240,235,0.28)",
                    zIndex: 1,
                  }} />
                  <div style={{ display: "flex", flexDirection: layout.isPhone ? "row" : "column", alignItems: layout.isPhone ? "baseline" : "flex-end", gap: layout.isPhone ? 8 : 0, paddingTop: layout.isPhone ? 6 : 2, paddingRight: layout.isPhone ? 0 : 10 }}>
                    <span style={{ fontSize: layout.isPhone ? 34 : 54, lineHeight: 1, fontWeight: 800, letterSpacing: -2, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{group.dayNumber}</span>
                    <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{group.sideLabel}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {group.items.map((item) => {
                      const visible = visibleKeys[item.id] ?? false;
                      const progressValue = item.progressEnd ?? item.progress ?? 0;
                      const progressStart = clamp(safeNumber(item.progressStart, progressValue), 0, 100);
                      const progressDelta = Math.max(0, progressValue - progressStart);
                      return (
                      <button
                        key={item.id}
                        type="button"
                        ref={(node) => {
                          itemRefs.current[item.id] = node;
                        }}
                        data-item-key={item.id}
                        onClick={() => onOpenDetail?.({ section: item.sectionKey, id: item.id })}
                        style={{
                          width: "100%",
                          border: `1px solid ${item.accent}2c`,
                          color: COLORS.dark.text,
                          borderRadius: 22,
                          background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${item.accent}10)`,
                          padding: layout.isPhone ? "16px" : "18px 20px",
                          boxShadow: "0 18px 34px rgba(0,0,0,0.14)",
                          textAlign: "left",
                          cursor: "pointer",
                          opacity: visible ? 1 : 0.42,
                          transform: visible ? "translateY(0)" : "translateY(18px)",
                          transition: "opacity 0.5s ease, transform 0.72s cubic-bezier(.16,1,.3,1)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Badge text={item.categoryLabel} color={item.accent} />
                            {item.status ? <StatusBadge status={item.status} /> : null}
                          </div>
                          <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{item.time}</span>
                        </div>
                        {item.poster ? (
                          <div style={{ display: "flex", gap: layout.isPhone ? 12 : 16, alignItems: "flex-start" }}>
                            <img
                              src={item.poster}
                              alt=""
                              style={{ width: layout.isPhone ? 58 : 72, height: layout.isPhone ? 84 : 104, borderRadius: 10, objectFit: "cover", flexShrink: 0, boxShadow: "0 8px 18px rgba(0,0,0,0.3)" }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h3 style={{ margin: "0 0 6px", fontSize: 18, lineHeight: 1.3, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>{item.title}</h3>
                              {item.progress !== null ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div style={{ position: "relative", height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                    <div style={{ position: "absolute", inset: 0, width: `${visible ? progressValue : 0}%`, borderRadius: 999, background: `linear-gradient(90deg, ${item.accent}99, ${item.accent}dd)`, boxShadow: `0 0 16px ${item.accent}44`, transition: "width 0.72s cubic-bezier(.16,1,.3,1)" }} />
                                    {progressDelta > 0 ? (
                                      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${progressStart}%`, width: `${visible ? progressDelta : 0}%`, borderRadius: 999, background: `linear-gradient(90deg, rgba(245,240,235,0.9), ${item.accent})`, boxShadow: `0 0 18px ${item.accent}66`, transition: "width 0.94s cubic-bezier(.16,1,.3,1)" }} />
                                    ) : null}
                                    {progressValue >= 100 ? (
                                      <div style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5f0eb", boxShadow: `0 0 12px ${item.accent}88` }} />
                                      </div>
                                    ) : null}
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: COLORS.dark.textMuted, flex: 1 }}>{item.summary || "진행 정보 없음"}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      {progressValue >= 100 ? <span style={{ fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>완독</span> : null}
                                      <span style={{ fontSize: 12, color: item.accent, fontFamily: "'Outfit', sans-serif" }}>{`${progressValue}%`}</span>
                                    </div>
                                  </div>
                                  {item.snippet ? (
                                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {item.snippet}
                                    </p>
                                  ) : null}
                                  {item.watchedEpisodesToday?.length > 0 ? (
                                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
                                      {item.watchedEpisodesToday.map((episode) => (
                                        <div key={episode.id} style={{ minWidth: 120, maxWidth: 120, display: "flex", flexDirection: "column", gap: 6 }}>
                                          <div style={{ width: 120, height: 68, borderRadius: 10, overflow: "hidden", background: `linear-gradient(135deg, ${item.accent}24, rgba(255,255,255,0.05))`, border: `1px solid ${item.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {episode.stillUrl ? <img src={episode.stillUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{episode.code}</span>}
                                          </div>
                                          <p style={{ margin: 0, fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{episode.code}</p>
                                          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: COLORS.dark.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{episode.title}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.summary || "기록 메모 없음"}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 style={{ margin: "0 0 8px", fontSize: 19, lineHeight: 1.35, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>{item.title}</h3>
                            {item.progress !== null ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ position: "relative", height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                  <div style={{ position: "absolute", inset: 0, width: `${visible ? progressValue : 0}%`, borderRadius: 999, background: `linear-gradient(90deg, ${item.accent}99, ${item.accent}dd)`, boxShadow: `0 0 16px ${item.accent}44`, transition: "width 0.72s cubic-bezier(.16,1,.3,1)" }} />
                                  {progressDelta > 0 ? (
                                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${progressStart}%`, width: `${visible ? progressDelta : 0}%`, borderRadius: 999, background: `linear-gradient(90deg, rgba(245,240,235,0.9), ${item.accent})`, boxShadow: `0 0 18px ${item.accent}66`, transition: "width 0.94s cubic-bezier(.16,1,.3,1)" }} />
                                  ) : null}
                                  {progressValue >= 100 ? (
                                    <div style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5f0eb", boxShadow: `0 0 12px ${item.accent}88` }} />
                                    </div>
                                  ) : null}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: COLORS.dark.textMuted, flex: 1 }}>{item.summary || "진행 정보 없음"}</p>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {progressValue >= 100 ? <span style={{ fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>완독</span> : null}
                                    <span style={{ fontSize: 12, color: item.accent, fontFamily: "'Outfit', sans-serif" }}>{`${progressValue}%`}</span>
                                  </div>
                                </div>
                                {item.snippet ? (
                                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                    {item.snippet}
                                  </p>
                                ) : null}
                                {item.watchedEpisodesToday?.length > 0 ? (
                                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
                                    {item.watchedEpisodesToday.map((episode) => (
                                      <div key={episode.id} style={{ minWidth: 120, maxWidth: 120, display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div style={{ width: 120, height: 68, borderRadius: 10, overflow: "hidden", background: `linear-gradient(135deg, ${item.accent}24, rgba(255,255,255,0.05))`, border: `1px solid ${item.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                          {episode.stillUrl ? <img src={episode.stillUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{episode.code}</span>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{episode.code}</p>
                                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: COLORS.dark.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{episode.title}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.summary || "기록 메모 없음"}</p>
                            )}
                          </>
                        )}
                      </button>
                    )})}
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>아직 표시할 기록이 없습니다.</p>}
            </div>
          </div>
        </GlassCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: layout.isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 14 }}>
          {calendarMonths.map((month) => (
            <GlassCard key={month.key} style={{ padding: layout.isPhone ? "16px" : "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>{month.label}</h3>
                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>기록일 강조</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
                {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                  <span key={day} style={{ fontSize: 11, color: COLORS.dark.textMuted, textAlign: "center" }}>{day}</span>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
                {month.cells.map((cell, idx) => (
                  <div
                    key={`${month.key}-${idx}`}
                    style={{
                      minHeight: 62,
                      borderRadius: 16,
                      border: `1px solid ${cell && cell.count > 0 ? "rgba(45,181,163,0.28)" : COLORS.dark.border}`,
                      background: !cell ? "transparent" : cell.count > 0 ? "linear-gradient(180deg, rgba(45,181,163,0.15), rgba(255,255,255,0.03))" : "rgba(255,255,255,0.02)",
                      padding: "10px 8px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    {cell ? (
                      <>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cell.count > 0 ? COLORS.dark.text : COLORS.dark.textMuted }}>{cell.day}</span>
                        <span style={{ fontSize: 11, color: cell.count > 0 ? COLORS.reading.main : "transparent", fontFamily: "'Outfit', sans-serif" }}>{cell.count > 0 ? `${cell.count}개` : "."}</span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};
