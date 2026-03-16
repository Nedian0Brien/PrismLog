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
  normalizeMetadataObject,
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
const ViewportHeightSync = lazy(() => import("./components/ViewportHeightSync"));
const ViewportDebugOverlay = lazy(() => import("./components/ViewportDebugOverlay"));

const RECORD_SECTION_KEYS = new Set(["reading", "study", "movie", "series", "game"]);

const parseAppRoute = (pathname) => {
  const normalized = (pathname || "/").replace(/\/+$/, "") || "/";
  if (normalized === "/timeline") return { page: "timeline", recordsSection: null };
  if (normalized === "/settings") return { page: "settings", recordsSection: null };
  if (normalized === "/records") return { page: "records", recordsSection: null };
  if (normalized.startsWith("/records/")) {
    const section = normalized.split("/")[2] || null;
    return {
      page: "records",
      recordsSection: section && RECORD_SECTION_KEYS.has(section) ? section : null,
    };
  }
  return { page: "home", recordsSection: null };
};

const buildAppPath = (page, recordsSection = null) => {
  if (page === "timeline") return "/timeline";
  if (page === "settings") return "/settings";
  if (page === "records") {
    return recordsSection && RECORD_SECTION_KEYS.has(recordsSection) ? `/records/${recordsSection}` : "/records";
  }
  return "/";
};

const serializeReadingSession = (session) => ({
  id: session?.id || "",
  date: session?.date || session?.ended_at || session?.endedAt || session?.started_at || session?.startedAt || new Date().toISOString(),
  from_pages: safeNumber(session?.from_pages ?? session?.fromPages, 0),
  to_pages: safeNumber(session?.to_pages ?? session?.toPages, 0),
  total_pages: safeNumber(session?.total_pages ?? session?.totalPages, 0),
  pages_read: safeNumber(session?.pages_read ?? session?.pagesRead, 0),
  from_progress: clamp(safeNumber(session?.from_progress ?? session?.fromProgress, 0), 0, 100),
  to_progress: clamp(safeNumber(session?.to_progress ?? session?.toProgress, 0), 0, 100),
  progress_delta: safeNumber(session?.progress_delta ?? session?.progressDelta, 0),
  started_at: session?.started_at || session?.startedAt || session?.date || null,
  ended_at: session?.ended_at || session?.endedAt || session?.date || null,
  duration_minutes: safeNumber(session?.duration_minutes ?? session?.durationMinutes, 0),
});

const serializeReadingNote = (note) => ({
  id: note?.id || "",
  date: note?.date || new Date().toISOString(),
  page: safeNumber(note?.page, 0),
  text: String(note?.text || "").trim(),
});

export default function PrismLog() {
  const initialRoute = useMemo(
    () => parseAppRoute(typeof window !== "undefined" ? window.location.pathname : "/"),
    []
  );
  const [page, setPage] = useState(initialRoute.page);
  const [recordsSection, setRecordsSection] = useState(initialRoute.recordsSection);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newLogCat, setNewLogCat] = useState("reading");
  const [glowEffect, setGlowEffect] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingReading, setEditingReading] = useState(null);
  const [editingStudy, setEditingStudy] = useState(null);
  const [editingCulture, setEditingCulture] = useState(null);
  const [recordsDetailTarget, setRecordsDetailTarget] = useState(null);
  const layout = useResponsiveLayout();
  const mainScrollRef = useRef(null);
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
    const handlePopState = () => {
      const nextRoute = parseAppRoute(window.location.pathname);
      setPage(nextRoute.page);
      setRecordsSection(nextRoute.recordsSection);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = useCallback((nextPage, nextRecordsSection = null, mode = "push") => {
    const resolvedRecordsSection = nextPage === "records" ? (nextRecordsSection ?? null) : null;
    setPage(nextPage);
    setRecordsSection(resolvedRecordsSection);

    if (typeof window === "undefined") return;
    const nextPath = buildAppPath(nextPage, resolvedRecordsSection);
    const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (currentPath === nextPath) return;
    window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", nextPath);
  }, []);

  const openTimelineRecordDetail = useCallback((target) => {
    if (!target?.section || !target?.id) return;
    setRecordsDetailTarget(target);
    navigateTo("records", target.section);
  }, [navigateTo]);


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
        entity_id: logInput.entity_id,
        title,
        summary: logInput.summary || "",
        tags: Array.isArray(logInput.tags) ? logInput.tags : [],
        payload: logInput.payload || {},
        occurred_at: logInput.occurred_at,
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

  const buildReadingSessionPatch = useCallback((book, nextRead, nextTotal, nextProgress) => {
    const nowIso = new Date().toISOString();
    const currentRead = Math.max(0, safeNumber(book.readPages));
    const currentProgress = clamp(safeNumber(book.progress), 0, 100);
    const sessions = Array.isArray(book.readingSessions)
      ? book.readingSessions.map(serializeReadingSession)
      : [];
    const providedStartedAt = String(book._nextReadingSessionTiming?.startedAt || "").trim();
    const providedEndedAt = String(book._nextReadingSessionTiming?.endedAt || "").trim();
    const sessionEndedAt = providedEndedAt || nowIso;
    const todayKey = sessionEndedAt.slice(0, 10);
    const existingIndex = sessions.findIndex((entry) => String(entry.date || "").slice(0, 10) === todayKey);
    const existing = existingIndex >= 0 ? sessions[existingIndex] : null;
    const startedAt = providedStartedAt || existing?.started_at || existing?.date || sessionEndedAt;
    const endedAt = sessionEndedAt;
    const startedTime = new Date(startedAt).getTime();
    const endedTime = new Date(endedAt).getTime();
    const durationMinutes = startedTime > 0 && endedTime >= startedTime
      ? Math.max(0, Math.round((endedTime - startedTime) / 60000))
      : 0;
    const nextSession = {
      id: existing?.id || `reading-session-${todayKey}`,
      date: endedAt,
      from_pages: safeNumber(existing?.from_pages, currentRead),
      to_pages: nextRead,
      total_pages: nextTotal,
      pages_read: Math.max(0, nextRead - safeNumber(existing?.from_pages, currentRead)),
      from_progress: clamp(safeNumber(existing?.from_progress, currentProgress), 0, 100),
      to_progress: nextProgress,
      progress_delta: Math.max(0, nextProgress - clamp(safeNumber(existing?.from_progress, currentProgress), 0, 100)),
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
    };
    if (existingIndex >= 0) sessions.splice(existingIndex, 1, nextSession);
    else sessions.unshift(nextSession);
    return sessions;
  }, []);

  const addReadingProgress = useCallback(async (book, progressInput = 10) => {
    const currentRead = Math.max(0, safeNumber(book.readPages));
    const currentTotal = Math.max(0, safeNumber(book.pages));
    const isStructuredInput = typeof progressInput === "object" && progressInput !== null;
    const nextRead = isStructuredInput
      ? Math.max(0, Math.round(Number(progressInput.currentPages)))
      : currentRead + Math.round(Number(progressInput));
    const candidateTotal = isStructuredInput
      ? Math.max(0, Math.round(Number(progressInput.totalPages)))
      : currentTotal;
    const nextTotal = candidateTotal > 0 ? candidateTotal : Math.max(currentTotal, nextRead);
    const nextReview = isStructuredInput && typeof progressInput.note === "string"
      ? progressInput.note.trim()
      : (book.review || "");

    if (!Number.isFinite(nextRead) || nextRead < 0) {
      throw new Error("현재 페이지는 0 이상의 숫자여야 합니다.");
    }
    if (!Number.isFinite(nextTotal) || nextTotal <= 0) {
      throw new Error("전체 페이지는 1 이상의 숫자여야 합니다.");
    }
    if (nextRead > nextTotal) {
      throw new Error("현재 페이지는 전체 페이지를 넘을 수 없습니다.");
    }

    const boundedRead = clamp(nextRead, 0, Math.max(nextTotal, 1));
    const nextProgress = nextTotal > 0 ? clamp(Math.round((boundedRead / nextTotal) * 100), 0, 100) : 0;
    const nextSessions = buildReadingSessionPatch(
      {
        ...book,
        _nextReadingSessionTiming: isStructuredInput
          ? { startedAt: progressInput.startedAt, endedAt: progressInput.endedAt }
          : null,
      },
      boundedRead,
      nextTotal,
      nextProgress,
    );
    const nextNotes = Array.isArray(book.readingNotes) ? book.readingNotes.map(serializeReadingNote) : [];
    if (isStructuredInput && typeof progressInput.note === "string" && progressInput.note.trim()) {
      nextNotes.unshift({
        id: `reading-note-${Date.now()}`,
        date: new Date().toISOString(),
        page: boundedRead,
        text: progressInput.note.trim(),
      });
    }

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
          enrichment_provider: book.enrichmentProvider || null,
          source_metadata: Object.keys(normalizeMetadataObject(book.sourceMetadata)).length > 0
            ? normalizeMetadataObject(book.sourceMetadata)
            : null,
          pages_read: boundedRead,
          pages_total: nextTotal,
          progress: nextProgress,
          rating: clamp(safeNumber(book.rating), 0, 5),
          review: nextReview,
          reading_sessions: nextSessions,
          reading_notes: nextNotes,
        },
      });
      setGlowEffect(COLORS.reading.main);
      setTimeout(() => setGlowEffect(null), 1200);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "기록 추가 실패");
    }
  }, [buildReadingSessionPatch, updateLog]);

  const addReadingNote = useCallback(async (book, noteInput) => {
    const text = String(noteInput?.text || "").trim();
    if (!text) throw new Error("메모 내용을 입력해 주세요.");
    const page = Math.max(0, safeNumber(noteInput?.page, book.readPages));
    const nextNotes = Array.isArray(book.readingNotes) ? book.readingNotes.map(serializeReadingNote) : [];
    nextNotes.unshift({
      id: `reading-note-${Date.now()}`,
      date: new Date().toISOString(),
      page,
      text,
    });
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
        enrichment_provider: book.enrichmentProvider || null,
        source_metadata: Object.keys(normalizeMetadataObject(book.sourceMetadata)).length > 0
          ? normalizeMetadataObject(book.sourceMetadata)
          : null,
        pages_read: Math.max(0, safeNumber(book.readPages)),
        pages_total: Math.max(0, safeNumber(book.pages)),
        progress: clamp(safeNumber(book.progress), 0, 100),
        rating: clamp(safeNumber(book.rating), 0, 5),
        review: book.review || "",
        reading_sessions: Array.isArray(book.readingSessions) ? book.readingSessions.map(serializeReadingSession) : [],
        reading_notes: nextNotes,
      },
    });
    setGlowEffect(COLORS.reading.main);
    setTimeout(() => setGlowEffect(null), 1200);
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

  const updateSeriesProgress = useCallback(async (logId, payload) => {
    await updateLog(logId, { payload });
    setGlowEffect(COLORS.series.main);
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
        onUpdateSeriesProgress={updateSeriesProgress}
        onAddReading={addReadingProgress}
        onAddReadingNote={addReadingNote}
        initialSection={recordsSection}
        initialDetailTarget={recordsDetailTarget}
        onSectionChange={(section) => {
          setRecordsDetailTarget(null);
          navigateTo("records", section);
        }}
        layout={layout}
      />;
      case "timeline": return <TimelinePage logs={logs} loading={loading} layout={layout} onOpenDetail={openTimelineRecordDetail} />;
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
    <div className={layout.isTabletUp ? "app-shell app-shell-immersive" : "app-shell"} style={{
      background: `radial-gradient(ellipse at top, #252220 0%, ${COLORS.dark.bg} 70%)`,
      fontFamily: "'Pretendard', 'Outfit', -apple-system, sans-serif",
      color: COLORS.dark.text,
      position: "relative",
      overflow: layout.isTabletUp ? "hidden" : "visible",
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
        @keyframes seriesEpisodeComplete {
          0% { transform: translateY(0) scale(1); }
          32% { transform: translateY(-4px) scale(1.02); }
          68% { transform: translateY(0) scale(1.01); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes seriesEpisodePulse {
          0% { box-shadow: 0 0 0 0 rgba(255,138,101,0.38); }
          55% { box-shadow: 0 0 0 10px rgba(255,138,101,0.08); }
          100% { box-shadow: 0 0 0 0 rgba(255,138,101,0); }
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

      <Suspense fallback={null}>
        <ViewportHeightSync />
        <ViewportDebugOverlay />
      </Suspense>

      {/* Glow effect on save (edge glow) */}
      {glowEffect && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none",
          boxShadow: `inset 0 0 80px 20px ${glowEffect}`,
          animation: "glowPulse 1.2s ease-out forwards",
          borderRadius: 0,
        }} />
      )}

      {/* Content */}
      <main
        ref={mainScrollRef}
        style={{
          flex: layout.isTabletUp ? 1 : "none",
          minHeight: layout.isTabletUp ? 0 : "auto",
          overflowY: layout.isTabletUp ? "auto" : "visible",
          WebkitOverflowScrolling: layout.isTabletUp ? "touch" : "auto",
          overscrollBehaviorY: layout.isTabletUp ? "contain" : "auto",
          padding: layout.isPhone
            ? "20px 16px calc(132px + var(--viewport-safe-bottom))"
            : "28px 24px calc(40px + var(--viewport-safe-bottom))",
        }}
      >
        <header style={{
          padding: layout.isPhone
            ? "calc(16px + var(--viewport-safe-top)) 16px 12px"
            : "calc(18px + var(--viewport-safe-top)) 24px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "relative", zIndex: 50,
          background: "rgba(26,24,22,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${COLORS.dark.border}`,
          margin: layout.isPhone ? "-20px -16px 20px" : "-28px -24px 28px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.reading.main}66, ${COLORS.culture.main}44)`,
              border: `1.5px solid ${COLORS.dark.border}`,
            }} />
          </div>
        </header>

        <div
          style={{
            width: "100%",
            maxWidth: layout.isTabletUp ? 1360 : 520,
            margin: "0 auto",
            animation: "fadeIn 0.45s ease-out",
          }}
        >
          <div style={{ display: "flex", gap: layout.isDesktop ? 24 : 20, alignItems: "flex-start" }}>
            {layout.isTabletUp && (
              <aside style={{ width: layout.isDesktop ? 220 : 92, flexShrink: 0, position: "sticky", top: 0 }}>
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
                          onClick={() => navigateTo(item.key, item.key === "records" ? recordsSection : null)}
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
        </div>
      </main>

      {/* FAB */}
      {!isAnySheetOpen && page !== "settings" && (
        layout.isPhone ? (
          <button
            onClick={() => { setSheetOpen(true); setNewLogCat("reading"); }}
            style={{
              position: "fixed",
              bottom: "calc(6.9rem + var(--viewport-safe-bottom))",
              right: "calc(20px + var(--safe-area-right))",
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
        ) : (
          <button
            onClick={() => { setSheetOpen(true); setNewLogCat("reading"); }}
            style={{
              position: "fixed",
              bottom: "calc(28px + var(--viewport-safe-bottom))",
              right: "calc(28px + var(--safe-area-right))",
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
        )
      )}

      {/* Bottom Nav */}
      {!layout.isTabletUp && !isAnySheetOpen && (
        <Suspense fallback={null}>
          <MobileFloatingNav items={navItems} activeKey={page} onChange={(nextPage) => navigateTo(nextPage, nextPage === "records" ? recordsSection : null)} />
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
        apiBaseUrl={API_BASE_URL}
      />
    </div>
  );
}
