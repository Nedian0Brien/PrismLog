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
import { Badge, GlassCard, StatusBadge, TimelineProgressBar } from "../ui";

export const TimelinePage = ({ logs, loading, layout, onOpenDetail }) => {
  const [view, setView] = useState("feed");
  const [visibleKeys, setVisibleKeys] = useState({});
  const itemRefs = useRef({});

  const groups = useMemo(() => {
    const computeReadingSnapshot = (log) => {
      const payload = log.session_payload || log.payload || {};
      const session = payload.current_session || {};
      const totalPages = safeNumber(session.total_pages || session.totalPages || payload.pages_total || payload.pages);
      const progressEnd = clamp(
        safeNumber(
          session.to_progress ?? session.toProgress,
          totalPages > 0 ? Math.round((safeNumber(session.to_pages ?? session.toPages ?? payload.pages_read) / totalPages) * 100) : payload.progress,
        ),
        0,
        100,
      );
      const progressStart = clamp(
        safeNumber(
          session.from_progress ?? session.fromProgress,
          Math.max(0, progressEnd - safeNumber(session.progress_delta ?? session.progressDelta, 0)),
        ),
        0,
        100,
      );
      const fromPages = safeNumber(session.from_pages ?? session.fromPages, 0);
      const toPages = safeNumber(session.to_pages ?? session.toPages ?? payload.pages_read, fromPages);
      const pagesRead = safeNumber(session.pages_read ?? session.read_pages ?? session.pagesRead, Math.max(0, toPages - fromPages));
      return {
        progressStart,
        progressEnd,
        fromPages,
        toPages,
        pagesRead,
        totalPages,
        startedAt: session.started_at || session.startedAt || log.occurred_at || log.created_at,
        endedAt: session.ended_at || session.endedAt || session.date || log.occurred_at || log.created_at,
        durationMinutes: safeNumber(session.duration_minutes ?? session.durationMinutes, 0),
        note: session.note || "",
      };
    };

    const computeStudyProgress = (log) => {
      const payload = log.session_payload || log.payload || {};
      const entity = log.entity || {};
      const entityMetadata = entity.entity_metadata || {};
      const studyChapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const studyCompleted = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
      const studyProgressMode = payload.progressMode || payload.progress_mode || "page";
      const studyPagesTotal = safeNumber(entityMetadata.pages_total || payload.pages_total || payload.pages);
      const studyPagesRead = safeNumber(payload.pages_read || payload.readPages);
      if (studyProgressMode === "page" && studyPagesTotal > 0) {
        return clamp(Math.round((studyPagesRead / studyPagesTotal) * 100), 0, 100);
      }
      if (studyChapters.length > 0) {
        return clamp(Math.round((studyCompleted / studyChapters.length) * 100), 0, 100);
      }
      return clamp(safeNumber(payload.progress), 0, 100);
    };

    // 1. 데이터 확장 (Flattening): 세션이 있는 경우 각각을 독립적인 로그 항목으로 분리
    const expandedLogs = [];
    logs.forEach((log) => {
      const payload = log.payload || {};
      
      // 독서 세션이 있는 경우 각 세션을 개별 항목으로 추출
      if (log.category === "reading" && Array.isArray(payload.reading_sessions) && payload.reading_sessions.length > 0) {
        payload.reading_sessions.forEach((session, idx) => {
          // 세션 날짜 정보 추출 (우선순위: ended_at > date > occurred_at)
          const sessionDate = session.ended_at || session.date || log.occurred_at || log.created_at;
          expandedLogs.push({
            ...log,
            id: `${log.id}-session-${idx}`,
            original_id: log.id,
            occurred_at: sessionDate,
            // 세션 전용 페이로드 구성 (해당 세션의 진행도 반영)
            session_payload: {
              ...payload,
              progress: session.progress ?? payload.progress,
              pages_read: session.pages_read ?? session.read_pages ?? payload.pages_read,
              current_session: session,
            },
            is_session: true,
          });
        });
      } else if (log.category === "culture" && (payload.type === "게임" || log.entity?.category === "게임") && Array.isArray(payload.game_sessions) && payload.game_sessions.length > 0) {
        payload.game_sessions.forEach((session, idx) => {
          const sessionDate = session.played_at || session.playedAt || session.date || log.occurred_at || log.created_at;
          expandedLogs.push({
            ...log,
            id: `${log.id}-game-session-${idx}`,
            original_id: log.id,
            occurred_at: sessionDate,
            session_payload: {
              ...payload,
              current_session: session,
            },
            is_session: true,
          });
        });
      } else {
        expandedLogs.push({ ...log, original_id: log.id });
      }
    });

    const chronologicalLogs = [...expandedLogs].sort((a, b) => {
      const dateA = new Date(a.occurred_at || a.created_at);
      const dateB = new Date(b.occurred_at || b.created_at);
      return dateA - dateB;
    });

    const readingDailyAggregates = new Map();
    const studyDailyAggregates = new Map();
    const latestStudyProgressByEntity = new Map();
    const latestStudyAmountByEntity = new Map();
    const collapsedLogs = [];

    chronologicalLogs.forEach((log) => {
      if (log.category === "reading") {
        const occurredAt = log.occurred_at || log.created_at;
        const dateKey = getDateKey(occurredAt);
        const entityKey = log.entity_id || log.original_id || log.id;
        const aggregateKey = `${dateKey}:${entityKey}`;
        const snapshot = computeReadingSnapshot(log);
        const existing = readingDailyAggregates.get(aggregateKey);

        if (!existing) {
          readingDailyAggregates.set(aggregateKey, {
            ...log,
            original_id: log.entity_id || log.original_id || log.id,
            occurred_at: occurredAt,
            title: log.entity?.title || log.title || "제목 없음",
            session_payload: {
              ...(log.session_payload || log.payload || {}),
              progress: snapshot.progressEnd,
              pages_read: snapshot.toPages,
              current_session: {
                from_pages: snapshot.fromPages,
                to_pages: snapshot.toPages,
                total_pages: snapshot.totalPages,
                pages_read: snapshot.pagesRead,
                from_progress: snapshot.progressStart,
                to_progress: snapshot.progressEnd,
                progress_delta: Math.max(0, snapshot.progressEnd - snapshot.progressStart),
                started_at: snapshot.startedAt,
                ended_at: snapshot.endedAt,
                duration_minutes: snapshot.durationMinutes,
                note: snapshot.note,
              },
            },
            is_session: true,
          });
        } else {
          const existingPayload = existing.session_payload || existing.payload || {};
          const existingSession = existingPayload.current_session || {};
          readingDailyAggregates.set(aggregateKey, {
            ...existing,
            ...log,
            original_id: log.entity_id || log.original_id || log.id,
            occurred_at: occurredAt,
            title: existing.title,
            session_payload: {
              ...existingPayload,
              ...(log.session_payload || log.payload || {}),
              progress: snapshot.progressEnd,
              pages_read: snapshot.toPages,
              current_session: {
                ...existingSession,
                from_pages: safeNumber(existingSession.from_pages ?? existingSession.fromPages, snapshot.fromPages),
                to_pages: snapshot.toPages,
                total_pages: snapshot.totalPages || safeNumber(existingSession.total_pages ?? existingSession.totalPages, 0),
                pages_read: safeNumber(existingSession.pages_read ?? existingSession.read_pages ?? existingSession.pagesRead, 0) + snapshot.pagesRead,
                from_progress: safeNumber(existingSession.from_progress ?? existingSession.fromProgress, snapshot.progressStart),
                to_progress: snapshot.progressEnd,
                progress_delta: Math.max(
                  0,
                  snapshot.progressEnd - safeNumber(existingSession.from_progress ?? existingSession.fromProgress, snapshot.progressStart),
                ),
                started_at: existingSession.started_at || existingSession.startedAt || snapshot.startedAt,
                ended_at: snapshot.endedAt,
                duration_minutes: safeNumber(existingSession.duration_minutes ?? existingSession.durationMinutes, 0) + snapshot.durationMinutes,
                note: snapshot.note || existingSession.note || "",
              },
            },
            is_session: true,
          });
        }
        return;
      }

      if (log.category !== "study") {
        collapsedLogs.push(log);
        return;
      }

      const occurredAt = log.occurred_at || log.created_at;
      const dateKey = getDateKey(occurredAt);
      const entityKey = log.entity_id || log.id;
      const aggregateKey = `${dateKey}:${entityKey}`;
      const payload = log.session_payload || log.payload || {};
      const entity = log.entity || {};
      const entityMetadata = entity.entity_metadata || {};
      const studyChapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const studyCompleted = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
      const studyProgressMode = payload.progressMode || payload.progress_mode || "page";
      const studyPagesTotal = safeNumber(entityMetadata.pages_total || payload.pages_total || payload.pages);
      const studyPagesRead = safeNumber(payload.pages_read || payload.readPages);
      const currentProgress = computeStudyProgress(log);
      const previousProgress = safeNumber(latestStudyProgressByEntity.get(entityKey), 0);
      const entityTitle = log.entity?.title || log.title || "제목 없음";
      const amountMode = studyProgressMode === "page" && studyPagesTotal > 0 ? "page" : studyChapters.length > 0 ? "chapter" : "percent";
      const currentAmount = amountMode === "page" ? studyPagesRead : amountMode === "chapter" ? studyCompleted : currentProgress;
      const previousAmount = safeNumber(latestStudyAmountByEntity.get(entityKey), 0);
      const existing = studyDailyAggregates.get(aggregateKey);

      if (!existing) {
        studyDailyAggregates.set(aggregateKey, {
          ...log,
          original_id: log.entity_id || log.id,
          title: entityTitle,
          occurred_at: occurredAt,
          study_progress_start: previousProgress,
          study_progress_end: currentProgress,
          study_amount_mode: amountMode,
          study_amount_start: previousAmount,
          study_amount_end: currentAmount,
          study_amount_total: amountMode === "page" ? studyPagesTotal : studyChapters.length,
        });
      } else {
        studyDailyAggregates.set(aggregateKey, {
          ...existing,
          ...log,
          original_id: log.entity_id || log.id,
          title: entityTitle,
          occurred_at: occurredAt,
          study_progress_start: existing.study_progress_start,
          study_progress_end: currentProgress,
          study_amount_mode: existing.study_amount_mode,
          study_amount_start: existing.study_amount_start,
          study_amount_end: currentAmount,
          study_amount_total: amountMode === "page" ? studyPagesTotal : studyChapters.length,
        });
      }

      latestStudyProgressByEntity.set(entityKey, currentProgress);
      latestStudyAmountByEntity.set(entityKey, currentAmount);
    });

    collapsedLogs.push(...readingDailyAggregates.values());
    collapsedLogs.push(...studyDailyAggregates.values());

    // 2. 정렬: occurred_at 기준 내림차순
    const sorted = collapsedLogs.sort((a, b) => {
      const dateA = new Date(a.occurred_at || a.created_at);
      const dateB = new Date(b.occurred_at || b.created_at);
      return dateB - dateA;
    });

    return sorted.reduce((acc, log) => {
      const dateSource = log.occurred_at || log.created_at;
      const key = getDateKey(dateSource);
      if (!key) return acc;

      const payload = log.session_payload || log.payload || {};
      const entity = log.entity || {};
      const entityMetadata = entity.entity_metadata || {};

      // 3. 카테고리 및 타입 분석 (디자인 톤 결정)
      const type = log.category === "culture" ? normalizeCultureType(payload.type || entity.category) : log.category;
      const accent = log.category === "reading"
        ? COLORS.reading.main
        : log.category === "study"
          ? COLORS.study.main
          : getCultureTone(type).main;

      // 4. 독서 세션 처리 (확장된 로그일 경우 현재 세션 정보 활용)
      const latestReadingSession = log.is_session ? payload.current_session : null;
      const readingPagesRead = safeNumber(
        latestReadingSession?.pages_read ?? latestReadingSession?.read_pages ?? latestReadingSession?.pagesRead,
        0,
      );
      const readingPagesTotal = safeNumber(
        latestReadingSession?.total_pages ?? latestReadingSession?.totalPages ?? payload.pages_total ?? payload.pages,
        0,
      );

      // 5. 공부 진행도 처리
      const studyChapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      const studyCompleted = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
      const studyProgressMode = payload.progressMode || payload.progress_mode || "page";
      const studyPagesTotal = safeNumber(entityMetadata.pages_total || payload.pages_total || payload.pages);
      const studyPagesRead = safeNumber(payload.pages_read || payload.readPages);
      let studyProgress = 0;
      if (studyProgressMode === "page" && studyPagesTotal > 0) {
        studyProgress = Math.round((studyPagesRead / studyPagesTotal) * 100);
      } else if (studyChapters.length > 0) {
        studyProgress = Math.round((studyCompleted / studyChapters.length) * 100);
      } else {
        studyProgress = clamp(safeNumber(payload.progress), 0, 100);
      }

      // 5. 시리즈 진행도 및 오늘 본 에피소드 (가로 스크롤용)
      const seriesMetrics = type === "시리즈"
        ? getSeriesProgressMetrics({
          episodeCount: entityMetadata?.episode_count || payload?.episode_count,
          seasons: entityMetadata?.seasons || payload?.seasons || [],
          watchedEpisodes: payload?.watched_episode_count,
          playtime: payload?.playtime,
          progress: payload?.progress,
        })
        : null;
      
      const seriesWatchDates = type === "시리즈" ? normalizeEpisodeWatchDates(payload?.episode_watch_dates) : {};
      const watchedEpisodesToday = (type === "시리즈" && Array.isArray(seriesMetrics?.seasons))
        ? seriesMetrics.seasons.flatMap((season) => (
          Array.isArray(season?.episodes) 
            ? season.episodes
                .filter((episode) => seriesWatchDates[`${season.seasonNumber}-${episode.episodeNumber}`]?.slice(0, 10) === key)
                .map((episode) => ({
                  id: `${log.id}-${season.seasonNumber}-${episode.episodeNumber}`,
                  title: episode.name || `EP ${episode.episodeNumber}`,
                  code: `S${season.seasonNumber} · E${episode.episodeNumber}`,
                  stillUrl: episode.stillUrl,
                }))
            : []
        ))
        : [];
      
      const seriesEpisodeCountToday = watchedEpisodesToday.length;
      const seriesProgressDelta = type === "시리즈" && safeNumber(seriesMetrics?.totalEpisodes, 0) > 0
        ? Math.min(100, (seriesEpisodeCountToday / safeNumber(seriesMetrics?.totalEpisodes, 0)) * 100)
        : 0;

      // 6. 통합 진행률 계산 (델타 애니메이션용)
      const progress = log.category === "reading"
        ? clamp(
          safeNumber(
            payload.progress,
            studyPagesTotal > 0 ? Math.round((studyPagesRead / studyPagesTotal) * 100) : 0,
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
        : log.category === "study"
          ? clamp(safeNumber(log.study_progress_start, progress), 0, 100)
        : type === "시리즈"
          ? clamp(safeNumber(progress, 0) - seriesProgressDelta, 0, 100)
        : progress;
      const deltaColor = log.category === "reading"
        ? COLORS.reading.progressSoft
        : log.category === "study"
          ? COLORS.study.light
          : `${accent}cc`;
      const studyAmountDelta = Math.max(0, safeNumber(log.study_amount_end) - safeNumber(log.study_amount_start));
      const absoluteDeltaLabel = log.category === "reading"
        ? (readingPagesRead > 0 ? `+${readingPagesRead}p` : "")
        : log.category === "study"
          ? (
              studyAmountDelta <= 0
                ? ""
                : log.study_amount_mode === "page"
                  ? `+${studyAmountDelta}p`
                  : log.study_amount_mode === "chapter"
                    ? `+${studyAmountDelta}챕터`
                    : `+${Math.max(0, safeNumber(log.study_progress_end) - safeNumber(log.study_progress_start))}%`
            )
          : type === "시리즈"
            ? (seriesEpisodeCountToday > 0 ? `+${seriesEpisodeCountToday}화` : "")
            : "";

      const sectionKey = log.category === "reading" ? "reading" : log.category === "study" ? "study" : type === "시리즈" ? "series" : type === "게임" ? "game" : "movie";

      // 7. UI 아이템 객체 구성
      const item = {
        id: log.id,
        originalId: log.originalId || log.original_id,
        title: log.category === "study"
          ? (entity.title || log.title || "제목 없음")
          : log.title || entity.title || "제목 없음",
        time: formatTimeLabel(dateSource),
        accent,
        sectionKey,
        type,
        categoryLabel: log.category === "reading" ? "독서" : log.category === "study" ? "공부" : type,
        summary: log.category === "reading"
          ? `${readingPagesRead || 0} / ${readingPagesTotal > 0 ? `${readingPagesTotal}p` : "?"}`
          : log.category === "study"
            ? (studyProgressMode === "page" && studyPagesTotal > 0 ? `${studyPagesRead} / ${studyPagesTotal}p` : `${studyChapters.length}개 챕터`)
            : payload.playtime || payload.status || "",
        snippet: (log.is_session && payload.current_session?.note) ? payload.current_session.note : (log.summary || ""),
        progress,
        progressStart,
        progressEnd: progress ?? 0,
        deltaColor,
        absoluteDeltaLabel,
        seriesEpisodeCountToday,
        seriesProgressDelta,
        watchedEpisodesToday,
        status: payload.status || (type === "게임" ? "플레이 중" : type === "시리즈" || type === "영화" ? "시청 중" : ""),
        poster: entityMetadata.cover || entityMetadata.poster || entityMetadata.image_url || entityMetadata.imageUrl || payload.cover || payload.poster || payload.image_url || payload.imageUrl || null,
      };

      const existing = acc.find((group) => group.key === key);
      if (existing) {
        existing.items.push(item);
      } else {
        const date = new Date(dateSource);
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

  const renderSeriesStats = (item) => (
    item.type === "시리즈" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        <div style={{ padding: "10px 8px", borderRadius: 14, border: `1px solid ${item.accent}22`, background: `linear-gradient(180deg, ${item.accent}16, rgba(255,255,255,0.03))` }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: COLORS.dark.textMuted, letterSpacing: 0.1, whiteSpace: "nowrap" }}>본 에피소드</p>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
            {item.seriesEpisodeCountToday}
            <span style={{ marginLeft: 2, fontSize: 11, color: COLORS.dark.textMuted, fontWeight: 400 }}>화</span>
          </p>
        </div>
        <div style={{ padding: "10px 8px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: COLORS.dark.textMuted, letterSpacing: 0.1, whiteSpace: "nowrap" }}>오늘 진행률</p>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
            +{Math.round(item.seriesProgressDelta)}
            <span style={{ marginLeft: 1, fontSize: 11, color: COLORS.dark.textMuted, fontWeight: 400 }}>%</span>
          </p>
        </div>
        <div style={{ padding: "10px 8px", borderRadius: 14, border: `1px solid ${item.accent}22`, background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${item.accent}12)` }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, color: COLORS.dark.textMuted, letterSpacing: 0.1, whiteSpace: "nowrap" }}>전체 진행률</p>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1, fontWeight: 800, color: item.accent, fontFamily: "'Outfit', sans-serif" }}>
            {item.progress}
            <span style={{ marginLeft: 1, fontSize: 11, color: COLORS.dark.textMuted, fontWeight: 400 }}>%</span>
          </p>
        </div>
      </div>
    ) : (
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: COLORS.dark.textMuted, flex: 1 }}>{item.summary || "진행 정보 없음"}</p>
    )
  );

  const renderTimelineProgress = (item, visible) => {
    const progressValue = item.progressEnd ?? item.progress ?? 0;
    const progressStart = clamp(safeNumber(item.progressStart, progressValue), 0, 100);
    const progressDelta = Math.max(0, progressValue - progressStart);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: -2 }}>
          {progressValue >= 100 ? <span style={{ fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>완독</span> : null}
          {progressDelta > 0 ? (
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "'Outfit', sans-serif" }}>
              {`+${Math.round(progressDelta)}%`}
            </span>
          ) : null}
          <span style={{ fontSize: 13, fontWeight: 700, color: item.accent, fontFamily: "'Outfit', sans-serif" }}>{`${progressValue}%`}</span>
        </div>
        <TimelineProgressBar
          value={progressValue}
          startValue={progressStart}
          accent={item.accent}
          deltaColor={item.deltaColor}
          visible={visible}
          height={14}
          transitionDelay="0.1s"
          deltaTransitionDelay="0.4s"
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {item.absoluteDeltaLabel ? (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: `${item.accent}18`, border: `1px solid ${item.accent}22`, fontSize: 11, fontWeight: 700, color: COLORS.dark.text }}>
              {item.absoluteDeltaLabel}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderSeriesStats(item)}
          </div>
        </div>
        {item.snippet ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.snippet}
          </p>
        ) : null}
        {item.watchedEpisodesToday?.length > 0 ? (
          <div style={{ minWidth: 0, width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity", paddingBottom: 4 }}>
              {item.watchedEpisodesToday.map((episode) => (
                <div key={episode.id} style={{ width: 120, minWidth: 120, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, scrollSnapAlign: "start" }}>
                  <div style={{ width: 120, height: 68, borderRadius: 10, overflow: "hidden", background: `linear-gradient(135deg, ${item.accent}24, rgba(255,255,255,0.05))`, border: `1px solid ${item.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {episode.stillUrl ? <img src={episode.stillUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{episode.code}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{episode.code}</p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: COLORS.dark.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{episode.title}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
  const lineLeft = layout.isPhone ? 17 : 92;

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
          <div style={{ position: "relative" }}>
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
                    left: layout.isPhone ? 11 : lineLeft - 6,
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                    {group.items.map((item) => {
                      const visible = visibleKeys[item.id] ?? false;
                      return (
                      <button
                        key={item.id}
                        type="button"
                        ref={(node) => {
                          itemRefs.current[item.id] = node;
                        }}
                        data-item-key={item.id}
                        onClick={() => onOpenDetail?.({ section: item.sectionKey, id: item.originalId || item.id })}
                        style={{
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          border: `1px solid ${item.accent}2c`,
                          color: COLORS.dark.text,
                          borderRadius: 22,
                          background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${item.accent}10)`,
                          padding: layout.isPhone ? "16px" : "18px 20px",
                          boxShadow: "0 18px 34px rgba(0,0,0,0.14)",
                          textAlign: "left",
                          cursor: "pointer",
                          overflow: "hidden",
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
                                renderTimelineProgress(item, visible)
                              ) : (
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.summary || "기록 메모 없음"}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 style={{ margin: "0 0 8px", fontSize: 19, lineHeight: 1.35, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>{item.title}</h3>
                            {item.progress !== null ? (
                              renderTimelineProgress(item, visible)
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
