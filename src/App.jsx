import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  API_BASE_URL,
  DEMO_USER_ID,
  COLORS,
  NAV_TAB_COLORS,
  useResponsiveLayout,
  safeNumber,
  clamp,
  extractIsbn13,
  formatRelativeTime,
  formatKoreanDateLabel,
  normalizeCultureType,
  BookIcon,
  PenIcon,
  FilmIcon,
  PlusIcon,
  CalendarIcon,
  TagIcon,
  HomeIcon,
  ClockIcon,
  SettingsIcon,
} from "./features/prismlog/core";
import { mapReadingLog, mapStudyLog, mapCultureLog } from "./features/prismlog/mappers";
import { GlassCard, BottomSheet, CategorySelector } from "./features/prismlog/ui";
import { NewLogForm, ReadingEditSheet, StudyEditSheet, CultureEditSheet } from "./features/prismlog/forms";
import { DashboardPage, RecordsPage, TimelinePage, SettingsPage } from "./features/prismlog/pages";

const MobileFloatingNav = lazy(() => import("./components/MobileFloatingNav"));

export default function PrismLog() {
  const [page, setPage] = useState("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newLogCat, setNewLogCat] = useState("reading");
  const [glowEffect, setGlowEffect] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingReading, setEditingReading] = useState(null);
  const [editingStudy, setEditingStudy] = useState(null);
  const [editingCulture, setEditingCulture] = useState(null);
  const layout = useResponsiveLayout();
  const viewportSyncFrameRef = useRef(null);
  const viewportSyncTimersRef = useRef([]);
  const maxViewportHeightRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const isAnySheetOpen = sheetOpen || Boolean(editingReading) || Boolean(editingStudy) || Boolean(editingCulture);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/logs?user_id=${encodeURIComponent(DEMO_USER_ID)}&limit=200`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "unknown error");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const root = document.documentElement;
    const syncViewportMetrics = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const width = window.innerWidth;

      if (viewportWidthRef.current === 0) {
        viewportWidthRef.current = width;
      }
      if (Math.abs(width - viewportWidthRef.current) > 120) {
        maxViewportHeightRef.current = height;
        viewportWidthRef.current = width;
      }
      if (height > maxViewportHeightRef.current) {
        maxViewportHeightRef.current = height;
      }

      const keyboardDelta = Math.max(0, maxViewportHeightRef.current - height - offsetTop);
      const keyboardOpen = keyboardDelta > 120;
      const keyboardInsetHeight = keyboardOpen ? keyboardDelta : 0;
      const appHeight = maxViewportHeightRef.current;
      const offsetBottom = 0;

      root.style.setProperty("--vh", `${height * 0.01}px`);
      root.style.setProperty("--app-vh", `${Math.round(appHeight)}px`);
      root.style.setProperty("--viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--visual-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--viewport-offset-top", `${Math.round(offsetTop)}px`);
      root.style.setProperty("--viewport-offset-bottom", `${Math.round(offsetBottom)}px`);
      root.style.setProperty("--keyboard-inset-height", `${Math.round(keyboardInsetHeight)}px`);
      root.dataset.keyboardOpen = keyboardOpen ? "true" : "false";
    };

    const clearScheduledViewportSync = () => {
      if (viewportSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportSyncFrameRef.current);
        viewportSyncFrameRef.current = null;
      }
      viewportSyncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      viewportSyncTimersRef.current = [];
    };

    const scheduleViewportSync = () => {
      clearScheduledViewportSync();
      viewportSyncFrameRef.current = window.requestAnimationFrame(() => {
        syncViewportMetrics();
        viewportSyncFrameRef.current = null;

        [120, 320, 700].forEach((delay) => {
          const timerId = window.setTimeout(syncViewportMetrics, delay);
          viewportSyncTimersRef.current.push(timerId);
        });
      });
    };

    syncViewportMetrics();
    scheduleViewportSync();

    const viewport = window.visualViewport;
    window.addEventListener("resize", scheduleViewportSync);
    window.addEventListener("orientationchange", scheduleViewportSync);
    window.addEventListener("scroll", scheduleViewportSync, { passive: true });
    viewport?.addEventListener("resize", scheduleViewportSync);
    viewport?.addEventListener("scroll", scheduleViewportSync);

    return () => {
      clearScheduledViewportSync();
      window.removeEventListener("resize", scheduleViewportSync);
      window.removeEventListener("orientationchange", scheduleViewportSync);
      window.removeEventListener("scroll", scheduleViewportSync);
      viewport?.removeEventListener("resize", scheduleViewportSync);
      viewport?.removeEventListener("scroll", scheduleViewportSync);
      delete root.dataset.keyboardOpen;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevOverscrollBehavior = body.style.overscrollBehavior;

    if (isAnySheetOpen) {
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
    }

    return () => {
      body.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscrollBehavior;
    };
  }, [isAnySheetOpen]);

  const readingLogs = useMemo(
    () => logs.filter((log) => log.category === "reading").map(mapReadingLog),
    [logs]
  );
  const studyLogs = useMemo(
    () => logs.filter((log) => log.category === "study").map(mapStudyLog),
    [logs]
  );
  const cultureLogs = useMemo(
    () => logs.filter((log) => log.category === "culture").map(mapCultureLog),
    [logs]
  );

  const ringValues = useMemo(() => ({
    reading: readingLogs.length,
    study: studyLogs.length,
    culture: cultureLogs.length,
  }), [readingLogs.length, studyLogs.length, cultureLogs.length]);

  const stats = useMemo(() => {
    const studyHours = studyLogs.reduce((sum, item) => sum + item.hours, 0);
    return [
      { label: "독서", value: `${readingLogs.length}권`, sub: "누적", color: COLORS.reading.main, icon: <BookIcon size={18} color={COLORS.reading.main} /> },
      { label: "공부", value: `${studyHours}h`, sub: "누적", color: COLORS.study.main, icon: <PenIcon size={18} color={COLORS.study.main} /> },
      { label: "문화", value: `${cultureLogs.length}편`, sub: "누적", color: COLORS.culture.main, icon: <FilmIcon size={18} color={COLORS.culture.main} /> },
    ];
  }, [readingLogs.length, studyLogs, cultureLogs.length]);

  const recentLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4)
      .map((log) => {
        const payload = log.payload || {};
        const color = log.category === "reading" ? COLORS.reading.main : log.category === "study" ? COLORS.study.main : COLORS.culture.main;
        let title = log.title;
        if (log.category === "reading") {
          title = `${log.title} · ${safeNumber(payload.progress)}% 읽음`;
        } else if (log.category === "study") {
          const completed = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
          title = `${log.title} · ${completed}개 챕터 완료`;
        } else if (log.category === "culture") {
          title = `${log.title} · ${normalizeCultureType(payload.type)} · ${payload.status || "상태 미설정"}`;
        }
        return { title, color, time: formatRelativeTime(log.created_at) };
      });
  }, [logs]);

  const todayLabel = useMemo(() => formatKoreanDateLabel(new Date().toISOString()), []);

  const saveLog = useCallback(async (logInput) => {
    const title = (logInput.title || "").trim();
    if (!title) throw new Error("제목을 입력해 주세요");
    const categoryColor = logInput.category === "reading"
      ? COLORS.reading.main
      : logInput.category === "study"
        ? COLORS.study.main
        : COLORS.culture.main;

    const response = await fetch(`${API_BASE_URL}/api/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: DEMO_USER_ID,
        category: logInput.category,
        title,
        summary: logInput.summary || "",
        tags: Array.isArray(logInput.tags) ? logInput.tags : [],
        payload: logInput.payload || {},
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    await fetchLogs();
    setSheetOpen(false);
    setGlowEffect(categoryColor);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [fetchLogs]);

  const updateLog = useCallback(async (logId, patch) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    await fetchLogs();
  }, [fetchLogs]);

  const deleteLog = useCallback(async (logId) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) throw new Error(`HTTP ${response.status}`);
    await fetchLogs();
  }, [fetchLogs]);

  const deleteFromEdit = useCallback(async (logId) => {
    await deleteLog(logId);
    setGlowEffect(COLORS.culture.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [deleteLog]);

  const openReadingEdit = useCallback((book) => {
    setEditingReading(book);
  }, []);

  const addReadingProgress = useCallback(async (book) => {
    const addedRaw = window.prompt("이번에 추가로 읽은 페이지 수를 입력하세요", "10");
    if (addedRaw === null) return;
    const addedPages = Number(addedRaw);
    if (!Number.isFinite(addedPages) || addedPages <= 0) {
      window.alert("1 이상의 숫자를 입력해 주세요.");
      return;
    }

    const currentRead = Math.max(0, safeNumber(book.readPages));
    const currentTotal = Math.max(0, safeNumber(book.pages));
    const nextRead = currentRead + Math.round(addedPages);
    const nextTotal = currentTotal > 0 ? currentTotal : nextRead;
    const boundedRead = clamp(nextRead, 0, Math.max(nextTotal, 1));
    const nextProgress = nextTotal > 0 ? clamp(Math.round((boundedRead / nextTotal) * 100), 0, 100) : 0;

    try {
      await updateLog(book.id, {
        payload: {
          author: book.author || "",
          publisher: book.publisher || null,
          isbn: book.isbn || null,
          isbn13: extractIsbn13(book.isbn) || null,
          published_date: book.publishedDate || null,
          description: book.description || null,
          cover: book.cover || null,
          source_provider: book.sourceProvider || null,
          source_id: book.sourceId || null,
          pages_read: boundedRead,
          pages_total: nextTotal,
          progress: nextProgress,
          rating: clamp(safeNumber(book.rating), 0, 5),
          review: book.review || "",
        },
      });
      setGlowEffect(COLORS.reading.main);
      setTimeout(() => setGlowEffect(null), 1200);
    } catch (error) {
      window.alert(`기록 추가 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, [updateLog]);

  const saveReadingEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingReading(null);
    setGlowEffect(COLORS.reading.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const openStudyEdit = useCallback((study) => {
    setEditingStudy(study);
  }, []);

  const saveStudyEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingStudy(null);
    setGlowEffect(COLORS.study.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const openCultureEdit = useCallback((item) => {
    setEditingCulture(item);
  }, []);

  const saveCultureEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingCulture(null);
    setGlowEffect(COLORS.culture.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const navItems = useMemo(() => [
    { key: "home", label: "홈", Icon: HomeIcon, color: NAV_TAB_COLORS.home },
    { key: "records", label: "기록", Icon: BookIcon, color: NAV_TAB_COLORS.records },
    { key: "timeline", label: "타임라인", Icon: ClockIcon, color: NAV_TAB_COLORS.timeline },
    { key: "settings", label: "설정", Icon: SettingsIcon, color: NAV_TAB_COLORS.settings },
  ], []);

  const renderPage = () => {
    switch (page) {
      case "records": return <RecordsPage
        readingLogs={readingLogs}
        studyLogs={studyLogs}
        cultureLogs={cultureLogs}
        loading={loading}
        onEditReading={openReadingEdit}
        onEditStudy={openStudyEdit}
        onEditCulture={openCultureEdit}
        onAddReading={addReadingProgress}
        layout={layout}
      />;
      case "timeline": return <TimelinePage logs={logs} loading={loading} layout={layout} />;
      case "settings": return <SettingsPage readingLogs={readingLogs} studyLogs={studyLogs} cultureLogs={cultureLogs} layout={layout} />;
      default: return <DashboardPage
        logs={logs}
        stats={stats}
        recentLogs={recentLogs}
        todayLabel={todayLabel}
        ringValues={ringValues}
        loading={loading}
        error={loadError}
        layout={layout}
      />;
    }
  };

  const iconButtonStyle = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="app-shell" style={{
      background: `radial-gradient(ellipse at top, #252220 0%, ${COLORS.dark.bg} 70%)`,
      fontFamily: "'Pretendard', 'Outfit', -apple-system, sans-serif",
      color: COLORS.dark.text,
      position: "relative", overflow: "hidden",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet" />

      {/* Global animations */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glowPulse { 
          0% { opacity: 0; } 
          30% { opacity: 1; } 
          100% { opacity: 0; } 
        }
        @keyframes prismShimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes viewSwitch {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardStaggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tabSwitch {
          from { opacity: 0; transform: translateY(10px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        * { box-sizing: border-box; }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input:focus, textarea:focus { border-color: rgba(255,255,255,0.2) !important; }
        @media (max-width: 767px) {
          input, textarea, select { font-size: 16px !important; }
        }
      `}</style>

      {/* Glow effect on save (edge glow) */}
      {glowEffect && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none",
          boxShadow: `inset 0 0 80px 20px ${glowEffect}`,
          animation: "glowPulse 1.2s ease-out forwards",
          borderRadius: 0,
        }} />
      )}

      {/* Header */}
      <header style={{
        padding: layout.isPhone
          ? "calc(16px + var(--viewport-safe-top)) 16px 12px"
          : "calc(18px + var(--viewport-safe-top)) 24px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(26,24,22,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${COLORS.dark.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* prism logo */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, position: "relative", overflow: "hidden",
            background: `linear-gradient(135deg, ${COLORS.reading.main}, ${COLORS.study.main}, ${COLORS.culture.main})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 18, height: 18, background: COLORS.dark.bg, borderRadius: 4,
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            }} />
          </div>
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
            background: `linear-gradient(90deg, ${COLORS.reading.main}, ${COLORS.study.main}, ${COLORS.culture.main})`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "prismShimmer 3s ease-in-out infinite",
          }}>PrismLog</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: layout.isPhone ? 8 : 12 }}>
          <button type="button" style={iconButtonStyle}>
            <CalendarIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          <button type="button" style={iconButtonStyle}>
            <TagIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          {/* avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.reading.main}66, ${COLORS.culture.main}44)`,
            border: `1.5px solid ${COLORS.dark.border}`,
          }} />
        </div>
      </header>

      {/* Content */}
      <main style={{
        padding: layout.isPhone
          ? "20px 16px calc(132px + var(--viewport-safe-bottom))"
          : "28px 24px calc(40px + var(--viewport-safe-bottom))",
        maxWidth: layout.isTabletUp ? 1360 : 520,
        margin: "0 auto",
        animation: "fadeIn 0.45s ease-out",
      }}>
        <div style={{ display: "flex", gap: layout.isDesktop ? 24 : 20, alignItems: "flex-start" }}>
          {layout.isTabletUp && (
            <aside style={{ width: layout.isDesktop ? 220 : 92, flexShrink: 0, position: "sticky", top: 104 }}>
              <GlassCard style={{ padding: layout.isDesktop ? "14px" : "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {navItems.map((item) => {
                    const active = page === item.key;
                    const activeColor = item.color || "#f5f0eb";
                    const Icon = item.Icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPage(item.key)}
                        style={{
                          width: "100%",
                          minHeight: 52,
                          padding: layout.isDesktop ? "12px 14px" : "12px 10px",
                          borderRadius: 16,
                          border: `1px solid ${active ? `${activeColor}44` : "transparent"}`,
                          background: active ? `${activeColor}14` : "transparent",
                          display: "flex",
                          flexDirection: layout.isDesktop ? "row" : "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: layout.isDesktop ? 10 : 6,
                          cursor: "pointer",
                          color: active ? activeColor : COLORS.dark.textMuted,
                          fontSize: layout.isDesktop ? 14 : 11,
                          fontWeight: active ? 700 : 600,
                          fontFamily: "'Pretendard', sans-serif",
                          transition: "all 0.2s",
                        }}
                      >
                        <span><Icon size={layout.isDesktop ? 20 : 18} color="currentColor" /></span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </aside>
          )}
          <div style={{ flex: 1, minWidth: 0, maxWidth: layout.isDesktop ? "none" : 920 }}>
            <div key={page} style={{ animation: "tabSwitch 0.3s cubic-bezier(.32,.72,.24,1)" }}>
              {renderPage()}
            </div>
          </div>
        </div>
      </main>

      {/* FAB */}
      {page !== "settings" && (
        <button
          onClick={() => { setSheetOpen(true); setNewLogCat("reading"); }}
          style={{
            position: "fixed",
            bottom: layout.isPhone ? "calc(6.9rem + var(--viewport-safe-bottom))" : "calc(28px + var(--viewport-safe-bottom))",
            right: layout.isPhone ? "calc(20px + var(--safe-area-right))" : "calc(28px + var(--safe-area-right))",
            width: 56, height: 56, borderRadius: "50%", border: "none",
            background: COLORS.reading.main,
            boxShadow: `0 4px 16px ${COLORS.reading.glow}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s", zIndex: 60,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <PlusIcon size={26} color="#fff" />
        </button>
      )}

      {/* Bottom Nav */}
      {!layout.isTabletUp && (
        <Suspense fallback={null}>
          <MobileFloatingNav items={navItems} activeKey={page} onChange={setPage} />
        </Suspense>
      )}

      {/* Bottom Sheet for new log */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={newLogCat === "reading" ? "새 책" : "새 기록"} layout={layout}>
        <CategorySelector selected={newLogCat} onSelect={setNewLogCat} layout={layout} />
        <NewLogForm category={newLogCat} onSubmit={saveLog} layout={layout} apiBaseUrl={API_BASE_URL} isOpen={sheetOpen} />
      </BottomSheet>

      <ReadingEditSheet
        open={Boolean(editingReading)}
        record={editingReading}
        onClose={() => setEditingReading(null)}
        onSave={saveReadingEdit}
        onDelete={deleteFromEdit}
        layout={layout}
        apiBaseUrl={API_BASE_URL}
      />

      <StudyEditSheet
        open={Boolean(editingStudy)}
        record={editingStudy}
        onClose={() => setEditingStudy(null)}
        onSave={saveStudyEdit}
        onDelete={deleteFromEdit}
        layout={layout}
      />

      <CultureEditSheet
        open={Boolean(editingCulture)}
        record={editingCulture}
        onClose={() => setEditingCulture(null)}
        onSave={saveCultureEdit}
        onDelete={deleteFromEdit}
        layout={layout}
      />
    </div>
  );
}
