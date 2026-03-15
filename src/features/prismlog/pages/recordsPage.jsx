import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  API_BASE_URL,
  buildCulturePayload,
  COLORS,
  CULTURE_TYPES,
  fetchMediaEnrichment,
  getResponsiveColumns,
  getCultureTone,
  getSeriesPlatformLabel,
  getSeriesPlatformTheme,
  getSeriesProgressMetrics,
  SeriesPlatformIcon,
  formatMonthDayLabel,
  clamp,
  safeNumber,
  BookIcon,
  PenIcon,
  PlusIcon,
  FilmIcon,
  ListIcon,
  GridIcon,
  GamepadIcon,
  CheckIcon,
  ChevronDown,
} from "../core";
import {
  HalfDonutChart,
  GlassCard,
  ProgressBar,
  IconActionButton,
  Badge,
  StatusBadge,
  RatingStars,
} from "../ui";

export const StudyAccordion = ({ study }) => {
  const [expanded, setExpanded] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {study.chapters.map((ch, i) => (
        <div key={i}>
          <button onClick={() => setExpanded(expanded === i ? null : i)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
            borderRadius: 12, border: `1px solid ${COLORS.dark.border}`,
            background: study.completed[i] ? `${COLORS.study.main}10` : "rgba(255,255,255,0.03)",
            cursor: "pointer", textAlign: "left", transition: "all 0.2s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              background: study.completed[i] ? COLORS.study.main : "rgba(255,255,255,0.08)",
              border: study.completed[i] ? "none" : `1.5px solid ${COLORS.dark.border}`,
              flexShrink: 0,
            }}>
              {study.completed[i] && <CheckIcon size={14} color="#1a1816" />}
            </div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: study.completed[i] ? COLORS.study.light : COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>{ch}</span>
            <ChevronDown size={14} color={COLORS.dark.textMuted} />
          </button>
          {expanded === i && (
            <div style={{
              margin: "4px 0 0 32px", padding: "12px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.dark.border}`,
              fontSize: 13, color: COLORS.dark.textMuted, lineHeight: 1.6,
            }}>
              {study.completed[i] ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><CheckIcon size={14} color={COLORS.dark.textMuted} /> 이 챕터의 학습을 완료했습니다.</div> : "아직 학습하지 않은 챕터입니다. 시작해볼까요?"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const getSeriesTmdbId = (item) => {
  const explicitId = safeNumber(item?.tmdbId, 0);
  if (explicitId > 0) return explicitId;
  const match = String(item?.sourceId || "").match(/^tmdb:series:(\d+)$/);
  return match ? safeNumber(match[1], 0) : null;
};

const createCultureFormLike = (item, overrides = {}) => ({
  title: item.title || "",
  type: item.type || "영화",
  status: overrides.status ?? item.status ?? "시청 중",
  playtime: item.playtime || "",
  watchedEpisodes: String(overrides.watchedEpisodes ?? item.watchedEpisodes ?? 0),
  rating: safeNumber(item.rating),
  poster: item.poster || "",
  releaseDate: item.releaseDate || "",
  overview: item.overview || item.summary || "",
  sourceProvider: item.sourceProvider || "",
  sourceId: item.sourceId || "",
  tmdbId: item.tmdbId || null,
  igdbId: item.igdbId || null,
  episodeCount: overrides.episodeCount ?? item.episodeCount ?? null,
  seasonCount: overrides.seasonCount ?? item.seasonCount ?? null,
  runtime: item.runtime ?? null,
  seasons: overrides.seasons ?? item.seasons ?? [],
  episodeWatchDates: overrides.episodeWatchDates ?? item.episodeWatchDates ?? {},
});

const formatEpisodeWatchDate = (isoLike) => (
  isoLike ? `${formatMonthDayLabel(isoLike)} 시청` : ""
);

const easeInOutQuint = (value) => (
  value < 0.5
    ? 16 * value ** 5
    : 1 - ((-2 * value + 2) ** 5) / 2
);

const getScrollableAncestor = (node) => {
  let current = node?.parentElement || null;
  while (current) {
    const style = window.getComputedStyle(current);
    const hasVerticalScroll = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    const hasHorizontalScroll = /(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;
    if (hasVerticalScroll || hasHorizontalScroll) return current;
    current = current.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const animateScrollAxis = (element, axis, target, duration = 760) => new Promise((resolve) => {
  const start = axis === "top" ? element.scrollTop : element.scrollLeft;
  const nextTarget = Math.max(target, 0);
  if (Math.abs(nextTarget - start) < 1) {
    resolve();
    return;
  }

  const startTime = performance.now();
  const step = (timestamp) => {
    const elapsed = Math.min((timestamp - startTime) / duration, 1);
    const eased = easeInOutQuint(elapsed);
    const nextValue = start + (nextTarget - start) * eased;
    if (axis === "top") {
      element.scrollTo({ top: nextValue, behavior: "auto" });
    } else {
      element.scrollTo({ left: nextValue, behavior: "auto" });
    }
    if (elapsed < 1) {
      window.requestAnimationFrame(step);
    } else {
      resolve();
    }
  };

  window.requestAnimationFrame(step);
});

const buildSeriesSeasonRows = (item) => {
  const metrics = getSeriesProgressMetrics(item);
  const episodeWatchDates = item.episodeWatchDates || {};
  let remainingWatched = metrics.watchedEpisodes;
  let currentPointer = null;
  let absoluteEpisodeCursor = 0;

  const seasons = metrics.seasons.map((season) => {
    const totalEpisodes = Math.max(safeNumber(season.episodeCount, season.episodes.length), 0);
    const watchedEpisodes = totalEpisodes > 0 ? Math.min(remainingWatched, totalEpisodes) : 0;
    remainingWatched = Math.max(remainingWatched - totalEpisodes, 0);

    const episodes = season.episodes.map((episode, index) => {
      absoluteEpisodeCursor += 1;
      const watched = index < watchedEpisodes;
      const isCurrent = !currentPointer && !watched && metrics.watchedEpisodes < metrics.totalEpisodes;
      if (isCurrent) {
        currentPointer = {
          seasonNumber: season.seasonNumber,
          episodeNumber: episode.episodeNumber,
          name: episode.name || `에피소드 ${episode.episodeNumber}`,
          stillUrl: episode.stillUrl || null,
          overview: episode.overview || null,
        };
      }
      const episodeKey = `${season.seasonNumber}-${episode.episodeNumber}`;
      return {
        ...episode,
        watched,
        isCurrent,
        absoluteEpisodeNumber: absoluteEpisodeCursor,
        episodeKey,
        watchedAt: episodeWatchDates[episodeKey] || null,
      };
    });

    const progress = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
    return {
      ...season,
      totalEpisodes,
      watchedEpisodes,
      progress,
      episodes,
    };
  });

  if (!currentPointer && metrics.totalEpisodes > 0 && metrics.watchedEpisodes >= metrics.totalEpisodes) {
    currentPointer = { seasonNumber: null, episodeNumber: null, name: "완주" };
  }

  return { metrics, seasons, currentPointer };
};

const getEpisodesToUnwatch = (seasons, targetEpisode, watchedEpisodes) => (
  seasons
    .flatMap((season) => season.episodes)
    .filter((episode) => (
      episode.absoluteEpisodeNumber >= targetEpisode.absoluteEpisodeNumber
      && episode.absoluteEpisodeNumber <= watchedEpisodes
    ))
);

const buildSeriesProgressTrend = (episodeWatchDates, totalEpisodes) => {
  const entries = Object.values(episodeWatchDates || {}).filter(Boolean);
  if (!entries.length || totalEpisodes <= 0) return [];

  const countsByDate = entries.reduce((acc, isoLike) => {
    const dateKey = String(isoLike).slice(0, 10);
    if (!dateKey) return acc;
    acc[dateKey] = (acc[dateKey] || 0) + 1;
    return acc;
  }, {});

  let cumulativeCount = 0;
  return Object.keys(countsByDate)
    .sort()
    .map((dateKey) => {
      cumulativeCount += countsByDate[dateKey];
      return {
        dateKey,
        label: formatMonthDayLabel(dateKey),
        progress: Math.min(Math.round((cumulativeCount / totalEpisodes) * 100), 100),
      };
    });
};

const SeriesProgressSummary = ({ item, accent }) => {
  const { metrics, seasons } = buildSeriesSeasonRows(item);
  const seasonCount = item.seasonCount || seasons.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.6, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
            {seasonCount > 0 ? `${seasonCount}시즌` : "시리즈 진행률"}
          </span>
          <strong style={{ fontSize: 13, color: COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>
            {metrics.playtimeLabel || "회차 미기록"}
          </strong>
        </div>
        <strong style={{ fontSize: 28, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", lineHeight: 0.9, letterSpacing: -0.8, display: "inline-flex", alignItems: "flex-start", gap: 1 }}>
          <span>{metrics.progress}</span>
          <span style={{ fontSize: 14, color: accent, lineHeight: 1.1, paddingTop: 2 }}>%</span>
        </strong>
      </div>
      <ProgressBar value={metrics.progress} color={accent} height={8} />
    </div>
  );
};

const SeriesPlatformBadge = ({ platformKey, platformLabel, accent = COLORS.series.main }) => {
  if (!platformKey) return null;
  const theme = getSeriesPlatformTheme(platformKey);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 8px",
      borderRadius: 999,
      border: `1px solid ${theme.border}`,
      background: theme.surface,
      color: COLORS.dark.textMuted,
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'Pretendard', sans-serif",
      lineHeight: 1,
    }}>
      <SeriesPlatformIcon platformKey={platformKey} size={14} color={theme.accent || accent} />
      <span>{getSeriesPlatformLabel(platformKey, platformLabel)}</span>
    </span>
  );
};

const SeriesProgressDonut = ({ value, size = 120, strokeWidth = 10, color = COLORS.series.main }) => {
  const safeValue = Math.max(0, Math.min(value, 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeValue / 100) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
    </svg>
  );
};

const FloatingSeriesProgressToast = ({ toast, visible, animatedProgress }) => {
  if (!toast) return null;

  return (
    <div style={{
      position: "fixed",
      top: 18,
      left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0" : "-34px"}) scale(${visible ? 1 : 0.98})`,
      opacity: visible ? 1 : 0,
      transition: "transform 420ms cubic-bezier(.2,.8,.2,1), opacity 320ms ease",
      zIndex: 260,
      width: "min(92vw, 520px)",
      pointerEvents: "none",
    }}>
      <div style={{
        borderRadius: 24,
        padding: "14px 16px",
        background: "rgba(28, 26, 24, 0.9)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1px solid ${COLORS.series.main}35`,
        boxShadow: "0 20px 48px rgba(0,0,0,0.28)",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) 88px", gap: 12, alignItems: "center" }}>
          <div style={{
            width: 72,
            height: 98,
            borderRadius: 16,
            overflow: "hidden",
            background: toast.poster ? COLORS.dark.surfaceSolid : `linear-gradient(155deg, ${COLORS.series.main}28, rgba(255,255,255,0.06))`,
            border: `1px solid ${COLORS.series.main}28`,
          }}>
            {toast.poster ? (
              <img src={toast.poster} alt={`${toast.title} 포스터`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FilmIcon size={26} color={COLORS.series.main} />
              </div>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: 1.1, color: COLORS.series.main, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              Watching Updated
            </p>
            <h4 style={{ margin: "0 0 6px", fontSize: 17, lineHeight: 1.2, color: COLORS.dark.text, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              {toast.title}
            </h4>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: COLORS.dark.textMuted }}>
              진행률이 업데이트되었습니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {toast.seasons.map((season) => (
                <div key={`toast-season-${season.seasonNumber}`} style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) 48px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{season.name || `S${season.seasonNumber}`}</span>
                  <ProgressBar value={season.progress} color={COLORS.series.main} height={6} />
                  <strong style={{ fontSize: 11, color: COLORS.series.main, fontFamily: "'Outfit', sans-serif", textAlign: "right" }}>{season.progress}%</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ position: "relative", width: 82, height: 82 }}>
              <SeriesProgressDonut value={animatedProgress} size={82} strokeWidth={8} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <strong style={{ fontSize: 20, color: COLORS.series.main, fontFamily: "'Outfit', sans-serif" }}>{animatedProgress}%</strong>
                <span style={{ fontSize: 10, color: COLORS.dark.textMuted }}>TOTAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SeriesProgressTrendChart = ({ points }) => {
  const [displayedProgress, setDisplayedProgress] = useState(points[points.length - 1]?.progress ?? 0);
  const displayedProgressRef = useRef(points[points.length - 1]?.progress ?? 0);
  if (!points.length) return null;

  const width = 220;
  const height = 104;
  const paddingX = 14;
  const paddingY = 14;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const maxIndex = Math.max(points.length - 1, 1);

  const coordinates = points.map((point, index) => {
    const x = paddingX + (innerWidth * (points.length === 1 ? 0.5 : index / maxIndex));
    const y = paddingY + innerHeight - ((point.progress / 100) * innerHeight);
    return { ...point, x, y };
  });
  const animatedProgressLabel = `${Math.round(displayedProgress)}%`;

  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - paddingY} L ${coordinates[0].x} ${height - paddingY} Z`;

  useEffect(() => {
    displayedProgressRef.current = displayedProgress;
  }, [displayedProgress]);

  useEffect(() => {
    const fromValue = displayedProgressRef.current;
    const toValue = points[points.length - 1]?.progress ?? 0;
    if (Math.round(fromValue) === Math.round(toValue)) {
      setDisplayedProgress(toValue);
      return undefined;
    }

    const duration = 460;
    const startedAt = window.performance.now();
    let rafId = 0;

    const step = (frameTime) => {
      const elapsed = Math.min((frameTime - startedAt) / duration, 1);
      const eased = 1 - ((1 - elapsed) ** 3);
      const nextValue = fromValue + ((toValue - fromValue) * eased);
      setDisplayedProgress(nextValue);
      if (elapsed < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [points]);

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 18,
      border: `1px solid ${COLORS.series.main}22`,
      background: "rgba(255,255,255,0.03)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: COLORS.series.main, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
          Progress Trend
        </p>
        <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>
          {`${points[0].label} → ${points[points.length - 1].label}`}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="seriesTrendFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,138,101,0.28)" />
            <stop offset="100%" stopColor="rgba(255,138,101,0.02)" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((value) => {
          const y = paddingY + innerHeight - ((value / 100) * innerHeight);
          return (
            <line
              key={`trend-grid-${value}`}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray="3 5"
            />
          );
        })}
        <path d={areaPath} fill="url(#seriesTrendFill)" />
        <path d={linePath} fill="none" stroke={COLORS.series.main} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <g key={`trend-point-${point.dateKey}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill={COLORS.dark.bg} stroke={COLORS.series.main} strokeWidth="2" />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{points[0].label}</span>
        <span style={{ fontSize: 11, color: COLORS.series.main, fontFamily: "'Outfit', sans-serif" }}>{animatedProgressLabel}</span>
      </div>
    </div>
  );
};

const SeriesDetailPage = ({ item, layout, onBack, onEdit, onUpdateSeriesProgress }) => {
  const [remoteSeriesData, setRemoteSeriesData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [attemptedRemoteLoad, setAttemptedRemoteLoad] = useState(false);
  const [optimisticWatchedEpisodes, setOptimisticWatchedEpisodes] = useState(null);
  const [savingEpisode, setSavingEpisode] = useState(null);
  const [animatedEpisodeKey, setAnimatedEpisodeKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [animatedToastProgress, setAnimatedToastProgress] = useState(0);
  const seasonRefs = useRef({});
  const seasonScrollerRefs = useRef({});
  const episodeRefs = useRef({});
  const [pendingUnwatchEpisode, setPendingUnwatchEpisode] = useState(null);
  const [highlightedEpisodeKey, setHighlightedEpisodeKey] = useState(null);
  const [detailEntering, setDetailEntering] = useState(false);
  const accent = COLORS.series.main;
  const successColor = "#63d2a4";
  const tmdbId = getSeriesTmdbId(item);

  useEffect(() => {
    setRemoteSeriesData(null);
    setLoadError("");
    setAttemptedRemoteLoad(false);
    setOptimisticWatchedEpisodes(null);
    setSavingEpisode(null);
    setAnimatedEpisodeKey(null);
    setToast(null);
    setToastVisible(false);
    setPendingUnwatchEpisode(null);
    setHighlightedEpisodeKey(null);
    setDetailEntering(false);
  }, [item.id]);

  useEffect(() => {
    let frameId = 0;
    setDetailEntering(false);
    frameId = window.requestAnimationFrame(() => {
      setDetailEntering(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [item.id]);

  useEffect(() => {
    if (!animatedEpisodeKey) return undefined;
    const timeoutId = window.setTimeout(() => setAnimatedEpisodeKey(null), 620);
    return () => window.clearTimeout(timeoutId);
  }, [animatedEpisodeKey]);

  useEffect(() => {
    if (item.seasons?.length > 0 || remoteSeriesData || !tmdbId || loadingDetails || attemptedRemoteLoad) return;
    let cancelled = false;

    const loadSeriesDetails = async () => {
      setAttemptedRemoteLoad(true);
      setLoadingDetails(true);
      setLoadError("");
      try {
        const enrich = await fetchMediaEnrichment(API_BASE_URL, tmdbId, "series");
        if (!cancelled && enrich) {
          setRemoteSeriesData({
            tmdbId,
            episodeCount: enrich.episode_count ?? item.episodeCount ?? null,
            seasonCount: enrich.season_count ?? item.seasonCount ?? null,
            runtime: enrich.runtime ?? item.runtime ?? null,
            seasons: enrich.seasons ?? [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "unknown error");
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };

    loadSeriesDetails();
    return () => {
      cancelled = true;
    };
  }, [attemptedRemoteLoad, item.episodeCount, item.runtime, item.seasonCount, item.seasons, loadingDetails, remoteSeriesData, tmdbId]);

  const effectiveItemBase = remoteSeriesData ? { ...item, ...remoteSeriesData } : item;
  const effectiveItem = optimisticWatchedEpisodes === null
    ? effectiveItemBase
    : { ...effectiveItemBase, watchedEpisodes: optimisticWatchedEpisodes };
  const { metrics, seasons, currentPointer } = buildSeriesSeasonRows(effectiveItem);
  const seasonCount = effectiveItem.seasonCount || seasons.length;
  const trendPoints = useMemo(
    () => buildSeriesProgressTrend(effectiveItem.episodeWatchDates, metrics.totalEpisodes),
    [effectiveItem.episodeWatchDates, metrics.totalEpisodes]
  );

  useEffect(() => {
    if (!toast) return undefined;

    setAnimatedToastProgress(toast.prevProgress);
    setToastVisible(false);

    const showTimer = window.setTimeout(() => setToastVisible(true), 30);
    const progressTimer = window.setTimeout(() => setAnimatedToastProgress(toast.nextProgress), 240);
    const hideTimer = window.setTimeout(() => setToastVisible(false), 2300);
    const clearTimer = window.setTimeout(() => setToast(null), 2820);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(progressTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [toast]);

  const scrollToEpisode = (target) => {
    if (!target?.seasonNumber || !target?.episodeNumber) return;
    const episodeKey = `${target.seasonNumber}-${target.episodeNumber}`;
    const seasonNode = seasonRefs.current[target.seasonNumber];
    const scrollerNode = seasonScrollerRefs.current[target.seasonNumber];
    const episodeNode = episodeRefs.current[episodeKey];
    if (!seasonNode || !scrollerNode || !episodeNode) return;

    const verticalContainer = getScrollableAncestor(seasonNode);
    const containerRect = verticalContainer.getBoundingClientRect ? verticalContainer.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    const seasonRect = seasonNode.getBoundingClientRect();
    const nextTop = verticalContainer.scrollTop + (seasonRect.top - containerRect.top) - Math.max(containerRect.height * 0.18, 96);

    animateScrollAxis(verticalContainer, "top", nextTop, 820).then(() => {
      const scrollerRect = scrollerNode.getBoundingClientRect();
      const episodeRect = episodeNode.getBoundingClientRect();
      const nextLeft = scrollerNode.scrollLeft + (episodeRect.left - scrollerRect.left) - ((scrollerRect.width - episodeRect.width) / 2);
      return animateScrollAxis(scrollerNode, "left", nextLeft, 720);
    }).then(() => {
      setHighlightedEpisodeKey(episodeKey);
      window.setTimeout(() => setHighlightedEpisodeKey((current) => (current === episodeKey ? null : current)), 1900);
    });
  };

  const commitEpisodeSelection = async (episode) => {
    if (!onUpdateSeriesProgress || !episode) return;
    const episodeKey = `${episode.seasonNumber}-${episode.episodeNumber}`;
    const startedAt = Date.now();
    const nextWatchedEpisodes = episode.watched
      ? Math.max(episode.absoluteEpisodeNumber - 1, 0)
      : episode.absoluteEpisodeNumber;
    const nextStatus = metrics.totalEpisodes > 0 && nextWatchedEpisodes >= metrics.totalEpisodes
      ? "시청 완료"
      : nextWatchedEpisodes > 0 ? "시청 중" : "기대 중";
    const nextEpisodeWatchDates = { ...(effectiveItem.episodeWatchDates || {}) };
    const nowIso = new Date().toISOString();
    seasons.forEach((season) => {
      season.episodes.forEach((seasonEpisode) => {
        if (seasonEpisode.absoluteEpisodeNumber <= nextWatchedEpisodes) {
          nextEpisodeWatchDates[seasonEpisode.episodeKey] = nextEpisodeWatchDates[seasonEpisode.episodeKey] || nowIso;
        } else {
          delete nextEpisodeWatchDates[seasonEpisode.episodeKey];
        }
      });
    });
    const nextItem = {
      ...effectiveItem,
      watchedEpisodes: nextWatchedEpisodes,
      status: nextStatus,
      episodeWatchDates: nextEpisodeWatchDates,
    };
    const nextRows = buildSeriesSeasonRows(nextItem);
    const payload = buildCulturePayload(createCultureFormLike(effectiveItem, {
      watchedEpisodes: nextWatchedEpisodes,
      status: nextStatus,
      episodeCount: effectiveItem.episodeCount ?? metrics.totalEpisodes ?? null,
      seasonCount: effectiveItem.seasonCount ?? seasons.length ?? null,
      seasons: metrics.seasons,
      episodeWatchDates: nextEpisodeWatchDates,
    }));

    setOptimisticWatchedEpisodes(nextWatchedEpisodes);
    setSavingEpisode(episodeKey);
    setAnimatedEpisodeKey(episodeKey);
    try {
      await onUpdateSeriesProgress(item.id, payload);
      const remainingDelay = Math.max(0, 560 - (Date.now() - startedAt));
      window.setTimeout(() => {
        const activeSeason = nextRows.seasons.find((season) => season.seasonNumber === episode.seasonNumber);
        setToast({
          id: `${item.id}-${episodeKey}-${Date.now()}`,
          title: effectiveItem.title,
          poster: effectiveItem.poster,
          prevProgress: metrics.progress,
          nextProgress: nextRows.metrics.progress,
          seasons: activeSeason ? [{
            seasonNumber: activeSeason.seasonNumber,
            name: activeSeason.name,
            progress: activeSeason.progress,
          }] : [],
        });
      }, remainingDelay);
    } catch (error) {
      setOptimisticWatchedEpisodes(null);
      window.alert(`시청 진행률 저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSavingEpisode(null);
    }
  };

  const handleEpisodeSelect = async (episode) => {
    if (!episode) return;
    if (episode.watched) {
      setPendingUnwatchEpisode({
        ...episode,
        affectedEpisodes: getEpisodesToUnwatch(seasons, episode, metrics.watchedEpisodes),
      });
      return;
    }
    await commitEpisodeSelection(episode);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: detailEntering ? 1 : 0,
        transform: detailEntering ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 24px, 0) scale(0.992)",
        transformOrigin: "center top",
        transition: "opacity 460ms cubic-bezier(.16,1,.3,1), transform 520ms cubic-bezier(.16,1,.3,1)",
        willChange: "opacity, transform",
      }}
    >
      <FloatingSeriesProgressToast toast={toast} visible={toastVisible} animatedProgress={animatedToastProgress} />
      {pendingUnwatchEpisode && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 255,
          background: "rgba(15, 14, 13, 0.46)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          animation: "fadeIn 0.22s ease-out",
        }}>
          <GlassCard glow={COLORS.series.glow} style={{ width: "min(92vw, 420px)", padding: "22px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                  Undo Completion
                </p>
                <h4 style={{ margin: "0 0 8px", fontSize: 20, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                  시청 완료를 해제할까요?
                </h4>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted }}>
                  {`시즌 ${pendingUnwatchEpisode.seasonNumber} · EP ${pendingUnwatchEpisode.episodeNumber} 완료를 해제하면 이 회차 이후 완료 표시도 함께 해제됩니다.`}
                </p>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "96px minmax(0, 1fr)",
                gap: 14,
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 18,
                border: `1px solid ${accent}22`,
                background: "rgba(255,255,255,0.03)",
              }}>
                <div style={{ position: "relative", height: 86 }}>
                  {pendingUnwatchEpisode.affectedEpisodes.slice(0, 3).map((episode, index, previewEpisodes) => (
                    <div
                      key={`unwatch-preview-${episode.episodeKey}`}
                      style={{
                        position: "absolute",
                        left: `${index * 18}px`,
                        top: `${index * 4}px`,
                        width: 54,
                        height: 78,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: `1px solid ${accent}26`,
                        background: episode.stillUrl ? COLORS.dark.surfaceSolid : `linear-gradient(145deg, ${accent}18, rgba(255,255,255,0.04))`,
                        boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
                        zIndex: previewEpisodes.length - index + (episode.episodeKey === pendingUnwatchEpisode.episodeKey ? 10 : 0),
                      }}
                    >
                      {episode.stillUrl ? (
                        <img src={episode.stillUrl} alt={`${episode.name || `EP ${episode.episodeNumber}`} 썸네일`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <FilmIcon size={16} color={accent} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", marginBottom: 6, fontSize: 14, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                    {pendingUnwatchEpisode.name || `EP ${pendingUnwatchEpisode.episodeNumber}`}
                  </strong>
                  <p style={{ margin: "0 0 6px", fontSize: 12, color: COLORS.dark.textMuted }}>
                    {`총 ${pendingUnwatchEpisode.affectedEpisodes.length}개 회차가 해제됩니다.`}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: COLORS.dark.textMuted }}>
                    {pendingUnwatchEpisode.affectedEpisodes.slice(0, 3).map((episode) => `EP ${episode.episodeNumber}`).join(" · ")}
                    {pendingUnwatchEpisode.affectedEpisodes.length > 3 ? ` · +${pendingUnwatchEpisode.affectedEpisodes.length - 3}` : ""}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setPendingUnwatchEpisode(null)}
                  style={{
                    minHeight: 42,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.dark.border}`,
                    background: "rgba(255,255,255,0.04)",
                    color: COLORS.dark.textMuted,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Pretendard', sans-serif",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const targetEpisode = pendingUnwatchEpisode;
                    setPendingUnwatchEpisode(null);
                    await commitEpisodeSelection(targetEpisode);
                  }}
                  style={{
                    minHeight: 42,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: `1px solid ${accent}45`,
                    background: `${accent}18`,
                    color: accent,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Pretendard', sans-serif",
                  }}
                >
                  완료 해제
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          border: `1px solid ${COLORS.dark.border}`,
          background: "rgba(255,255,255,0.03)",
          color: COLORS.dark.text,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Pretendard', sans-serif",
        }}
      >
        ← 시리즈 목록
      </button>

      <GlassCard glow={COLORS.series.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "180px minmax(0, 1fr) 158px", gap: 18, alignItems: "start" }}>
          <div style={{
            minHeight: 252,
            borderRadius: 22,
            overflow: "hidden",
            border: `1px solid ${accent}26`,
            background: effectiveItem.poster
              ? COLORS.dark.surfaceSolid
              : `linear-gradient(155deg, ${accent}2a, rgba(255,255,255,0.04))`,
            boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
          }}>
            {effectiveItem.poster ? (
              <img src={effectiveItem.poster} alt={`${effectiveItem.title} 포스터`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: `${accent}aa` }}>
                <FilmIcon size={48} color={`${accent}aa`} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                  Series Detail
                </p>
                <h3 style={{ margin: "0 0 8px", fontSize: layout.isPhone ? 24 : 30, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                  {effectiveItem.title}
                </h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <StatusBadge status={effectiveItem.status} />
                  <SeriesPlatformBadge platformKey={effectiveItem.platformKey} platformLabel={effectiveItem.platformLabel} accent={accent} />
                  {effectiveItem.releaseDate && <Badge text={formatMonthDayLabel(effectiveItem.releaseDate)} color={accent} />}
                  {effectiveItem.tags.map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
                </div>
              </div>
              <IconActionButton onClick={() => onEdit(effectiveItem)} />
            </div>

            {(effectiveItem.overview || effectiveItem.summary) && (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: COLORS.dark.textMuted }}>
                {effectiveItem.overview || effectiveItem.summary}
              </p>
            )}

            <div style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: `1px solid ${accent}22`,
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gridTemplateColumns: layout.isPhone ? "84px minmax(0, 1fr)" : "104px minmax(0, 1fr)",
              gap: 12,
              alignItems: "start",
            }}>
              <button
                type="button"
                onClick={() => scrollToEpisode(currentPointer)}
                style={{
                  padding: 0,
                  width: layout.isPhone ? 84 : 104,
                  height: layout.isPhone ? 60 : 74,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: currentPointer?.stillUrl
                    ? COLORS.dark.surfaceSolid
                    : `linear-gradient(145deg, ${accent}18, rgba(255,255,255,0.04))`,
                  border: `1px solid ${accent}22`,
                  cursor: currentPointer?.seasonNumber ? "pointer" : "default",
                }}
              >
                {currentPointer?.stillUrl ? (
                  <img src={currentPointer.stillUrl} alt={`${currentPointer.name} 썸네일`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FilmIcon size={18} color={accent} />
                  </div>
                )}
              </button>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                  Next episode
                </p>
                <button
                  type="button"
                  onClick={() => scrollToEpisode(currentPointer)}
                  style={{
                    display: "block",
                    margin: "0 0 6px",
                    padding: 0,
                    background: "none",
                    border: "none",
                    fontSize: 15,
                    color: COLORS.dark.text,
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    textAlign: "left",
                    cursor: currentPointer?.seasonNumber ? "pointer" : "default",
                  }}
                >
                  {currentPointer
                    ? currentPointer.seasonNumber
                      ? `시즌 ${currentPointer.seasonNumber} · ${currentPointer.name}`
                      : currentPointer.name
                    : "다음 회차 정보 없음"}
                </button>
                {currentPointer?.overview && (
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: COLORS.dark.textMuted,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {currentPointer.overview}
                  </p>
                )}
              </div>
            </div>

            <div style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: `1px solid ${accent}24`,
              background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.03))`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>Watching status</p>
                  <strong style={{ fontSize: 15, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                    {metrics.playtimeLabel || "회차 미기록"}
                  </strong>
                </div>
                {effectiveItem.rating > 0 && <RatingStars rating={effectiveItem.rating} size={14} />}
              </div>
              <ProgressBar value={metrics.progress} color={accent} height={8} />
            </div>

            <div style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: `1px solid ${accent}22`,
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {seasons.map((season) => (
                <div key={`hero-season-${season.seasonNumber}`} style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) 48px", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{season.name || `S${season.seasonNumber}`}</span>
                  <ProgressBar value={season.progress} color={accent} height={6} />
                  <strong style={{ fontSize: 12, color: accent, fontFamily: "'Outfit', sans-serif", textAlign: "right" }}>{season.progress}%</strong>
                </div>
              ))}
            </div>

            {(loadingDetails || loadError) && item.seasons?.length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: loadError ? "#f8b4bb" : COLORS.dark.textMuted }}>
                {loadError ? `시즌 정보를 불러오지 못했습니다: ${loadError}` : "시즌 정보를 불러오는 중..."}
              </p>
            )}
          </div>

            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            gap: 8,
            padding: "16px 0 4px",
          }}>
            <div style={{ position: "relative", width: layout.isPhone ? 126 : 144, height: layout.isPhone ? 126 : 144 }}>
              <SeriesProgressDonut value={metrics.progress} size={layout.isPhone ? 126 : 144} strokeWidth={12} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, color: COLORS.dark.textMuted, letterSpacing: 0.5 }}>TOTAL</span>
                <strong style={{ fontSize: layout.isPhone ? 28 : 34, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                  {metrics.progress}%
                </strong>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              {metrics.playtimeLabel || "회차 미기록"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              {seasonCount > 0 ? `${seasonCount}시즌` : "시즌 정보 없음"}
              {effectiveItem.runtime ? ` · 평균 ${effectiveItem.runtime}분` : ""}
            </p>
            <div style={{ width: "100%" }}>
              <SeriesProgressTrendChart points={trendPoints} />
            </div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
            Season Board
          </p>
          <h4 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
            시즌별 진행 현황
          </h4>
        </div>

        {seasons.length === 0 ? (
          <GlassCard style={{ padding: "18px 20px" }}>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>
              시즌 상세 정보가 아직 없습니다. 새로 추가한 시리즈이거나 TMDB 보강이 완료되면 회차별 목록이 표시됩니다.
            </p>
          </GlassCard>
        ) : (
          seasons.map((season) => (
            <GlassCard
              key={`${item.id}-season-${season.seasonNumber}`}
              glow={COLORS.series.glow}
              style={{ padding: "18px 20px" }}
              className=""
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  ref={(node) => {
                    seasonRefs.current[season.seasonNumber] = node;
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}
                >
                  <div>
                    <h5 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                      {season.name || `시즌 ${season.seasonNumber}`}
                    </h5>
                    <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
                      {[
                        season.airDate ? formatMonthDayLabel(season.airDate) : null,
                        season.totalEpisodes > 0 ? `시즌 총 ${season.totalEpisodes}화` : null,
                        season.watchedEpisodes > 0 ? `${season.watchedEpisodes}화 시청함` : null,
                      ].filter(Boolean).join(" · ") || "메타데이터 없음"}
                    </p>
                  </div>
                  <strong style={{ fontSize: 14, color: accent, fontFamily: "'Outfit', sans-serif" }}>
                    {season.progress}%
                  </strong>
                </div>

                <ProgressBar value={season.progress} color={accent} height={7} />

                <div
                  ref={(node) => {
                    seasonScrollerRefs.current[season.seasonNumber] = node;
                  }}
                  style={{
                  display: "flex",
                  gap: 12,
                  overflowX: "auto",
                  paddingBottom: 4,
                  WebkitOverflowScrolling: "touch",
                  scrollSnapType: "x proximity",
                }}>
                  {season.episodes.length === 0 ? (
                    <div style={{
                      padding: "14px 16px",
                      borderRadius: 16,
                      border: `1px dashed ${accent}36`,
                      background: "rgba(255,255,255,0.02)",
                      color: COLORS.dark.textMuted,
                      fontSize: 12,
                      minWidth: 220,
                    }}>
                      회차 상세 정보가 없습니다.
                    </div>
                  ) : season.episodes.map((episode) => {
                    const episodeKey = `${episode.seasonNumber}-${episode.episodeNumber}`;
                    const isSaving = savingEpisode === episodeKey;
                    const isAnimating = animatedEpisodeKey === episodeKey;
                    return (
                    <div
                      key={`${item.id}-season-${season.seasonNumber}-episode-${episode.episodeNumber}`}
                      ref={(node) => {
                        episodeRefs.current[episodeKey] = node;
                      }}
                      onClick={() => {
                        if (!episode.watched) handleEpisodeSelect(episode);
                      }}
                      onKeyDown={(event) => {
                        if (savingEpisode) return;
                        if ((event.key === "Enter" || event.key === " ") && !episode.watched) {
                          event.preventDefault();
                          handleEpisodeSelect(episode);
                        }
                      }}
                      role="button"
                      tabIndex={savingEpisode ? -1 : 0}
                      aria-disabled={Boolean(savingEpisode)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: `1px solid ${episode.isCurrent ? `${accent}66` : episode.watched ? `${accent}36` : COLORS.dark.border}`,
                        background: episode.watched
                          ? `${accent}14`
                          : episode.isCurrent
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(255,255,255,0.03)",
                        boxShadow: highlightedEpisodeKey === episodeKey
                          ? `0 0 0 1px ${accent}40, 0 0 28px ${accent}20`
                          : isAnimating
                            ? `0 0 0 1px ${successColor}55 inset, 0 12px 28px ${successColor}22`
                            : episode.isCurrent ? `0 0 0 1px ${accent}22 inset` : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        width: layout.isPhone ? 244 : 276,
                        minWidth: layout.isPhone ? 244 : 276,
                        minHeight: layout.isPhone ? 350 : 366,
                        textAlign: "left",
                        cursor: savingEpisode ? "wait" : "pointer",
                        opacity: isSaving ? 0.72 : 1,
                        scrollSnapAlign: "start",
                        animation: isAnimating ? "seriesEpisodeComplete 560ms cubic-bezier(.2,.8,.2,1)" : highlightedEpisodeKey === episodeKey ? "seriesEpisodePulse 1.5s ease-out 2" : "none",
                      }}
                    >
                      <div style={{
                        position: "relative",
                        borderRadius: 14,
                        overflow: "hidden",
                        height: 144,
                        background: COLORS.dark.surfaceSolid,
                        border: `1px solid ${episode.watched ? `${successColor}4d` : COLORS.dark.border}`,
                      }}>
                        {episode.stillUrl ? (
                          <img
                            src={episode.stillUrl}
                            alt={`${episode.name || `에피소드 ${episode.episodeNumber}`} 썸네일`}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            background: `linear-gradient(155deg, ${accent}20, rgba(255,255,255,0.04))`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: episode.watched ? successColor : accent,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            No Still
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: "0 0 4px", fontSize: 11, color: episode.watched ? accent : COLORS.dark.textMuted }}>
                              EP {episode.episodeNumber}
                            </p>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: COLORS.dark.text, fontWeight: 600 }}>
                              {episode.name || `제 ${episode.episodeNumber}화`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEpisodeSelect(episode);
                            }}
                            disabled={Boolean(savingEpisode)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              border: episode.watched || isSaving ? "none" : `1.5px solid ${COLORS.dark.text}77`,
                              background: isSaving
                                ? "rgba(255,255,255,0.14)"
                                : episode.watched
                                  ? successColor
                                  : "rgba(26,24,22,0.52)",
                              color: episode.watched ? "#182017" : COLORS.dark.text,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              boxShadow: episode.watched ? `0 8px 18px ${successColor}26` : "none",
                              animation: isAnimating ? "seriesEpisodeComplete 560ms cubic-bezier(.2,.8,.2,1)" : "none",
                              cursor: savingEpisode ? "wait" : "pointer",
                            }}
                          >
                            <CheckIcon size={14} color={episode.watched ? "#182017" : COLORS.dark.textMuted} />
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: COLORS.dark.textMuted }}>
                          {[episode.airDate ? formatMonthDayLabel(episode.airDate) : null, episode.runtime ? `${episode.runtime}분` : null].filter(Boolean).join(" · ") || "방영 정보 없음"}
                        </p>
                        {episode.overview && (
                          <p style={{
                            margin: 0,
                            fontSize: 12,
                            lineHeight: 1.55,
                            color: COLORS.dark.textMuted,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {episode.overview}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: "auto" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: episode.watched ? `${successColor}18` : episode.isCurrent ? `${accent}18` : "rgba(255,255,255,0.04)",
                          color: episode.watched ? successColor : episode.isCurrent ? accent : COLORS.dark.textMuted,
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {isSaving ? "저장 중" : episode.watched ? "시청 완료" : episode.isCurrent ? "다음 회차" : "미시청"}
                        </span>
                        {episode.watchedAt && (
                          <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>
                            {formatEpisodeWatchDate(episode.watchedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
};

/* ──────────── Page: Dashboard ──────────── */
export const DashboardPage = ({ logs, stats, recentLogs, todayLabel, ringValues, loading, error, layout }) => {
  const [trendMode, setTrendMode] = useState("cumulative");
  const [trendEnabled, setTrendEnabled] = useState({ reading: true, study: true, culture: true });
  const [distributionEnabled, setDistributionEnabled] = useState({ reading: true, study: true, culture: true });
  const [heatmapCategory, setHeatmapCategory] = useState("all");

  const trendDailySeries = useMemo(() => buildTrendSeries(logs, 14), [logs]);
  const trendSeries = useMemo(() => {
    if (trendMode === "daily") return trendDailySeries;
    const running = { reading: 0, study: 0, culture: 0 };
    return trendDailySeries.map((day) => {
      running.reading += day.reading;
      running.study += day.study;
      running.culture += day.culture;
      return { ...day, ...running };
    });
  }, [trendMode, trendDailySeries]);

  const distribution = useMemo(
    () => CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = logs.filter((log) => log.category === key).length;
      return acc;
    }, {}),
    [logs]
  );

  const selectedHeatmap = useMemo(() => {
    if (heatmapCategory === "all") return buildHeatmapMatrix(logs);
    return buildHeatmapMatrix(logs.filter((log) => log.category === heatmapCategory));
  }, [logs, heatmapCategory]);

  const analyticsGridStyle = {
    display: "grid",
    gridTemplateColumns: layout.isDesktop ? "minmax(0, 1.2fr) minmax(0, 0.8fr)" : layout.isTablet ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: 16,
    alignItems: "start",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 14, color: COLORS.dark.textMuted, margin: "0 0 4px", fontFamily: "'Outfit', sans-serif" }}>{todayLabel}</p>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif", lineHeight: 1.3 }}>
          기록 대시보드
        </h2>
      </div>

      {error && (
        <GlassCard style={{ border: "1px solid rgba(230,57,70,0.35)", background: "rgba(230,57,70,0.08)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#f8b4bb" }}>백엔드 연결 실패: {error}</p>
        </GlassCard>
      )}

      <GlassCard style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: layout.isPhone ? 12 : 20, padding: layout.isDesktop ? "24px 28px" : layout.isPhone ? "18px 16px" : "20px" }}>
        <div style={{ width: 180, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <SpectrumRing reading={ringValues.reading} study={ringValues.study} culture={ringValues.culture} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr) auto",
              alignItems: "center",
              gap: layout.isPhone ? 8 : 10,
              padding: layout.isPhone ? "8px 0" : "10px 0",
              borderBottom: `1px solid ${COLORS.dark.border}`,
            }}>
              <div style={{ color: s.color, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24 }}>
                {s.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: COLORS.dark.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                <span style={{ display: "block", fontSize: 11, color: COLORS.dark.textMuted }}>{s.sub}</span>
              </div>
              <span style={{ fontSize: layout.isPhone ? 17 : 18, fontWeight: 800, color: s.color, fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap" }}>{s.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <div style={analyticsGridStyle}>
        <GlassCard style={layout.isDesktop ? { gridColumn: "1 / 2" } : {}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>추세선</h4>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { key: "cumulative", label: "누적" },
                { key: "daily", label: "일간" },
              ].map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setTrendMode(mode.key)}
                  style={{
                    padding: "6px 11px",
                    borderRadius: 999,
                    border: `1px solid ${trendMode === mode.key ? `${COLORS.reading.main}77` : COLORS.dark.border}`,
                    background: trendMode === mode.key ? `${COLORS.reading.main}20` : "rgba(255,255,255,0.03)",
                    color: trendMode === mode.key ? COLORS.reading.main : COLORS.dark.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Pretendard', sans-serif",
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <CategoryToggleChips
            enabled={trendEnabled}
            onToggle={(key) => setTrendEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
          />
          <div style={{ marginTop: 12 }}>
            <TrendLineChart series={trendSeries} enabled={trendEnabled} />
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>전체 분포</h4>
            <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>누적 기록 수</span>
          </div>
          <CategoryToggleChips
            enabled={distributionEnabled}
            onToggle={(key) => setDistributionEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
          />
          <div style={{ marginTop: 12 }}>
            <DistributionBarChart counts={distribution} enabled={distributionEnabled} />
          </div>
        </GlassCard>

        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>기록 히트맵</h4>
            <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>최근 5주</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "전체", color: "#f5f0eb" },
              ...CATEGORY_KEYS.map((key) => ({ key, label: CATEGORY_META[key].label, color: CATEGORY_META[key].color })),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setHeatmapCategory(item.key)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: `1px solid ${heatmapCategory === item.key ? `${item.color}88` : COLORS.dark.border}`,
                  background: heatmapCategory === item.key ? `${item.color}20` : "rgba(255,255,255,0.04)",
                  color: heatmapCategory === item.key ? item.color : COLORS.dark.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Pretendard', sans-serif",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Heatmap matrix={selectedHeatmap} />
        </GlassCard>

        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 12px", fontFamily: "'Outfit', sans-serif" }}>최근 기록</h4>
          {loading ? (
            <GlassCard style={{ padding: "14px 16px" }}>
              <p style={{ fontSize: 13, color: COLORS.dark.textMuted, margin: 0 }}>기록을 불러오는 중...</p>
            </GlassCard>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentLogs.length === 0 && (
                <GlassCard style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: 13, color: COLORS.dark.textMuted, margin: 0 }}>아직 기록이 없습니다.</p>
                </GlassCard>
              )}
              {recentLogs.map((log, i) => (
                <GlassCard key={`${log.title}-${i}`} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 4, height: 32, borderRadius: 2, background: log.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark.text, margin: 0 }}>{log.title}</p>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.dark.textMuted, flexShrink: 0 }}>{log.time}</span>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ──────────── Reading: Grid Card ──────────── */
export const ReadingProgressModal = ({
  book,
  layout,
  saving,
  error,
  currentPages,
  totalPages,
  note,
  onCurrentPagesChange,
  onTotalPagesChange,
  onNoteChange,
  onClose,
  onSubmit,
}) => {
  if (!book) return null;
  const accent = COLORS.reading.main;
  const parsedTotalPages = Math.max(0, safeNumber(totalPages));
  const parsedCurrentPages = clamp(safeNumber(currentPages), 0, Math.max(parsedTotalPages, 1));
  const remainingPages = Math.max(0, parsedTotalPages - parsedCurrentPages);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: "rgba(15, 14, 13, 0.54)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.22s ease-out",
      }}
      onClick={onClose}
    >
      <GlassCard
        glow={COLORS.reading.glow}
        style={{ width: "min(92vw, 430px)", padding: layout.isPhone ? "22px 18px" : "24px 22px" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                Reading Update
              </p>
              <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                읽은 페이지 추가
              </h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                border: `1px solid ${COLORS.dark.border}`,
                background: "rgba(255,255,255,0.04)",
                color: COLORS.dark.textMuted,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: layout.isPhone ? "84px minmax(0, 1fr)" : "96px minmax(0, 1fr)",
            gap: 14,
            alignItems: "center",
            padding: "12px 14px",
            borderRadius: 18,
            border: `1px solid ${accent}24`,
            background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{
              width: layout.isPhone ? 84 : 96,
              aspectRatio: "2 / 3",
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${accent}24`,
              background: book.cover ? COLORS.dark.surfaceSolid : `linear-gradient(145deg, ${accent}22, rgba(255,255,255,0.04))`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {book.cover ? (
                <img src={book.cover} alt={`${book.title} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <BookIcon size={24} color={accent} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", marginBottom: 6, fontSize: 15, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                {book.title}
              </strong>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: COLORS.dark.textMuted }}>
                {book.author || "저자 정보 없음"}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: accent }}>
                {`${parsedCurrentPages}/${parsedTotalPages || safeNumber(book.pages)}p 읽음`}
                {remainingPages > 0 ? ` · ${remainingPages}p 남음` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>현재 페이지</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentPages}
                onChange={(event) => onCurrentPagesChange(event.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 16,
                  border: `1px solid ${error ? "#f19aa4" : `${accent}28`}`,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.dark.text,
                  padding: "0 16px",
                  fontSize: 16,
                  fontFamily: "'Outfit', sans-serif",
                  outline: "none",
                }}
                placeholder="현재"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>전체 페이지</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={totalPages}
                onChange={(event) => onTotalPagesChange(event.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 16,
                  border: `1px solid ${error ? "#f19aa4" : `${accent}28`}`,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.dark.text,
                  padding: "0 16px",
                  fontSize: 16,
                  fontFamily: "'Outfit', sans-serif",
                  outline: "none",
                }}
                placeholder="전체"
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>진행 슬라이더</label>
              <span style={{ fontSize: 12, color: accent, fontFamily: "'Outfit', sans-serif" }}>
                {parsedTotalPages > 0 ? `${Math.round((parsedCurrentPages / parsedTotalPages) * 100)}%` : "0%"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(parsedTotalPages, 1)}
              step="1"
              value={Math.min(parsedCurrentPages, Math.max(parsedTotalPages, 1))}
              onChange={(event) => onCurrentPagesChange(event.target.value)}
              style={{ width: "100%", accentColor: accent }}
            />
            {error ? (
              <p style={{ margin: 0, fontSize: 12, color: "#f19aa4" }}>{error}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
                절대 페이지 기준으로 현재 위치를 바로 업데이트합니다.
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>메모</label>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={4}
              placeholder="오늘 읽은 내용이나 짧은 메모를 남겨보세요."
              style={{
                width: "100%",
                borderRadius: 16,
                border: `1px solid ${accent}24`,
                background: "rgba(255,255,255,0.04)",
                color: COLORS.dark.text,
                padding: "14px 16px",
                fontSize: 13,
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                fontFamily: "'Pretendard', sans-serif",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 14,
                border: `1px solid ${COLORS.dark.border}`,
                background: "rgba(255,255,255,0.04)",
                color: COLORS.dark.textMuted,
                cursor: saving ? "wait" : "pointer",
                fontWeight: 700,
                fontFamily: "'Pretendard', sans-serif",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              style={{
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 14,
                border: "none",
                background: accent,
                color: "#122018",
                cursor: saving ? "wait" : "pointer",
                fontWeight: 800,
                fontFamily: "'Pretendard', sans-serif",
                boxShadow: `0 14px 30px ${accent}30`,
              }}
            >
              {saving ? "업데이트 중..." : "독서 기록 반영"}
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export const ReadingDetailPage = ({ book, layout, onBack, onEdit, onAdd }) => {
  const accent = COLORS.reading.main;
  const progress = clamp(safeNumber(book.progress), 0, 100);
  const tags = Array.isArray(book.tags) ? book.tags : [];
  const publishedLabel = book.publishedDate ? formatMonthDayLabel(book.publishedDate) : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.32s ease-out" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          border: `1px solid ${COLORS.dark.border}`,
          background: "rgba(255,255,255,0.03)",
          color: COLORS.dark.text,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Pretendard', sans-serif",
        }}
      >
        ← 독서 목록
      </button>

      <GlassCard glow={COLORS.reading.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "156px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <div style={{
            minHeight: 228,
            borderRadius: 22,
            overflow: "hidden",
            border: `1px solid ${accent}24`,
            background: book.cover ? COLORS.dark.surfaceSolid : `linear-gradient(150deg, ${accent}24, rgba(255,255,255,0.04))`,
            boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {book.cover ? (
              <img src={book.cover} alt={`${book.title} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <BookIcon size={42} color={accent} />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                  Reading Detail
                </p>
                <h3 style={{ margin: "0 0 6px", fontSize: layout.isPhone ? 24 : 30, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                  {book.title}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>
                  {book.author || "저자 정보 없음"}
                </p>
              </div>
              <IconActionButton onClick={() => onEdit(book)} />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {book.publisher && <Badge text={book.publisher} color={accent} />}
              {publishedLabel && <Badge text={publishedLabel} color={accent} />}
              {tags.map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
            </div>

            <div style={{
              padding: "14px 16px",
              borderRadius: 18,
              border: `1px solid ${accent}22`,
              background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.03))`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>Reading progress</p>
                  <strong style={{ fontSize: 26, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                    {progress}%
                  </strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>Pages</p>
                  <strong style={{ fontSize: 15, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                    {`${book.readPages}/${book.pages}p`}
                  </strong>
                </div>
              </div>
              <ProgressBar value={progress} color={accent} height={8} />
            </div>

            {book.description && (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: COLORS.dark.textMuted }}>
                {book.description}
              </p>
            )}

            {book.review && (
              <GlassCard style={{ padding: "14px 16px" }}>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: COLORS.dark.textMuted, fontStyle: "italic" }}>
                  "{book.review}"
                </p>
              </GlassCard>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onAdd(book)}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 14,
                  border: `1px solid ${accent}66`,
                  background: `${accent}18`,
                  color: accent,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Pretendard', sans-serif",
                }}
              >
                + 독서 기록 추가
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export const ReadingGridCard = ({ book, onEdit, onAdd, onOpen, layout }) => {
  const chartSize = layout.isDesktop ? 188 : layout.isTablet ? 176 : 164;
  return (
    <GlassCard
      glow={COLORS.reading.glow}
      onClick={() => onOpen(book)}
      style={{
        padding: "12px 12px 12px",
        minHeight: layout.isPhone ? 320 : 350,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
        textAlign: "center",
        cursor: "pointer",
      }}
  >
    <div style={{ position: "relative", width: chartSize, height: chartSize - 26, alignSelf: "center", marginTop: -2, maxWidth: "100%" }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <HalfDonutChart value={book.progress} size={chartSize} strokeWidth={14} color={COLORS.reading.main} />
        <div style={{
          position: "absolute", top: layout.isPhone ? 37 : 41, left: "50%", transform: "translateX(-50%)",
          width: layout.isPhone ? 62 : 68, height: layout.isPhone ? 88 : 94, borderRadius: 12, overflow: "hidden",
          background: `linear-gradient(135deg, ${COLORS.reading.main}33, ${COLORS.reading.main}11)`,
          border: `1px solid ${COLORS.reading.main}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
        }}>
          {book.cover ? (
            <img src={book.cover} alt={`${book.title} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <BookIcon size={18} color={COLORS.reading.main} />
          )}
        </div>
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.reading.main, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
        {book.progress}%
      </span>
      <h4 style={{
        fontSize: 14, fontWeight: 700, color: COLORS.dark.text, margin: 0,
        fontFamily: "'Pretendard', sans-serif", lineHeight: 1.35,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {book.title}
      </h4>
      <p style={{ fontSize: 11, color: COLORS.dark.textMuted, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {book.author}
      </p>
    </div>

    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 2 }}>
      <span style={{ fontSize: 10, color: COLORS.dark.textMuted }}>{book.readPages}/{book.pages}p</span>
      {book.rating > 0 && <RatingStars rating={book.rating} size={11} />}
    </div>

    {book.review && (
      <p style={{
        fontSize: 10,
        color: COLORS.dark.textMuted,
        margin: 0,
        fontStyle: "italic",
        lineHeight: 1.4,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
      }}>"{book.review}"</p>
    )}

    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
      {book.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.reading.main} />)}
    </div>

    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAdd(book);
        }}
        style={{
          flex: 1, minHeight: 38, borderRadius: 12, border: `1px solid ${COLORS.reading.main}66`,
          background: `${COLORS.reading.main}18`, color: COLORS.reading.main, fontSize: 12, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "'Pretendard', sans-serif",
        }}
      >
        <PlusIcon size={14} color={COLORS.reading.main} />
        기록 추가
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(book);
        }}
        style={{
          flex: 1, minHeight: 38, borderRadius: 12, border: `1px solid ${COLORS.study.main}66`,
          background: `${COLORS.study.main}18`, color: COLORS.study.main, fontSize: 12, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "'Pretendard', sans-serif",
        }}
      >
        <PenIcon size={14} color={COLORS.study.main} />
        수정
      </button>
    </div>
    </GlassCard>
  );
};

/* ──────────── Page: Reading ──────────── */
export const ReadingPage = ({ books, loading, onEdit, onAdd, layout }) => {
  const [viewMode, setViewMode] = useState("list");
  const [detailId, setDetailId] = useState(null);
  const [progressModalBook, setProgressModalBook] = useState(null);
  const [currentPageInput, setCurrentPageInput] = useState("0");
  const [totalPageInput, setTotalPageInput] = useState("0");
  const [noteInput, setNoteInput] = useState("");
  const [progressError, setProgressError] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const detailBook = books.find((book) => book.id === detailId) || null;

  useEffect(() => {
    if (detailId && !detailBook && books.length > 0) {
      setDetailId(null);
    }
  }, [books.length, detailBook, detailId]);

  const openProgressModal = useCallback((book) => {
    setProgressModalBook(book);
    setCurrentPageInput(String(safeNumber(book.readPages)));
    setTotalPageInput(String(Math.max(safeNumber(book.pages), safeNumber(book.readPages))));
    setNoteInput(book.review || "");
    setProgressError("");
  }, []);

  const closeProgressModal = useCallback(() => {
    if (savingProgress) return;
    setProgressModalBook(null);
    setCurrentPageInput("0");
    setTotalPageInput("0");
    setNoteInput("");
    setProgressError("");
  }, [savingProgress]);

  const submitProgressModal = useCallback(async () => {
    if (!progressModalBook) return;
    const currentPages = Number(currentPageInput);
    const totalPages = Number(totalPageInput);
    if (!Number.isFinite(currentPages) || currentPages < 0) {
      setProgressError("현재 페이지는 0 이상의 숫자여야 합니다.");
      return;
    }
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      setProgressError("전체 페이지는 1 이상의 숫자여야 합니다.");
      return;
    }
    if (currentPages > totalPages) {
      setProgressError("현재 페이지는 전체 페이지를 넘을 수 없습니다.");
      return;
    }
    try {
      setSavingProgress(true);
      setProgressError("");
      await onAdd(progressModalBook, {
        currentPages,
        totalPages,
        note: noteInput,
      });
      setProgressModalBook(null);
      setCurrentPageInput("0");
      setTotalPageInput("0");
      setNoteInput("");
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "페이지 업데이트 중 오류가 발생했습니다.");
    } finally {
      setSavingProgress(false);
    }
  }, [currentPageInput, noteInput, onAdd, progressModalBook, totalPageInput]);

  if (detailBook) {
    return (
      <>
        <ReadingDetailPage
          book={detailBook}
          layout={layout}
          onBack={() => setDetailId(null)}
          onEdit={onEdit}
          onAdd={openProgressModal}
        />
        <ReadingProgressModal
          book={progressModalBook}
          layout={layout}
          saving={savingProgress}
          error={progressError}
          currentPages={currentPageInput}
          totalPages={totalPageInput}
          note={noteInput}
          onCurrentPagesChange={(value) => {
            setCurrentPageInput(value);
            setProgressError("");
          }}
          onTotalPagesChange={(value) => {
            setTotalPageInput(value);
            setProgressError("");
          }}
          onNoteChange={(value) => {
            setNoteInput(value);
            setProgressError("");
          }}
          onClose={closeProgressModal}
          onSubmit={submitProgressModal}
        />
      </>
    );
  }

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
          <BookIcon size={20} color={COLORS.reading.main} /> 독서 기록
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: COLORS.dark.textMuted }}>{books.length}권</span>
          {/* view toggle */}
          <div style={{
            display: "flex", border: `1px solid ${COLORS.dark.border}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {[
              { mode: "list", Icon: ListIcon },
              { mode: "grid", Icon: GridIcon },
            ].map(({ mode, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                  background: viewMode === mode ? `${COLORS.reading.main}22` : "transparent",
                  border: "none", cursor: "pointer",
                  color: viewMode === mode ? COLORS.reading.main : COLORS.dark.textMuted,
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                <Icon size={16} color={viewMode === mode ? COLORS.reading.main : COLORS.dark.textMuted} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && books.length === 0 && (
        <GlassCard>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>독서 기록이 없습니다.</p>
        </GlassCard>
      )}

      {viewMode === "list" ? (
        <div key="reading-list" style={{ display: "flex", flexDirection: "column", gap: 16, animation: "viewSwitch 0.28s ease-out" }}>
          {books.map((book, idx) => (
            <div
              key={book.id}
              style={{
                animation: "cardStaggerIn 0.32s ease-out both",
                animationDelay: `${Math.min(idx * 45, 220)}ms`,
              }}
            >
              <GlassCard glow={COLORS.reading.glow} style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setDetailId(book.id)}>
                <div style={{ display: "flex", flexDirection: layout.isPhone ? "column" : "row", gap: 16 }}>
                  <div style={{
                    width: 60, height: 84, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                    background: `linear-gradient(135deg, ${COLORS.reading.main}33, ${COLORS.reading.main}11)`,
                    border: `1px solid ${COLORS.reading.main}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {book.cover ? (
                      <img src={book.cover} alt={`${book.title} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <BookIcon size={24} color={COLORS.reading.main} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 2px", fontFamily: "'Pretendard', sans-serif" }}>{book.title}</h4>
                        <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: 0 }}>{book.author}</p>
                      </div>
                      <span style={{ display: "inline-block", fontSize: 22, fontWeight: 800, color: COLORS.reading.main, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                        {book.progress}%
                      </span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <ProgressBar value={book.progress} color={COLORS.reading.main} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{book.readPages}/{book.pages}p</span>
                        {book.rating > 0 && <RatingStars rating={book.rating} size={12} />}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openProgressModal(book);
                          }}
                          style={{
                            minHeight: 34,
                            padding: "0 12px",
                            borderRadius: 12,
                            border: `1px solid ${COLORS.reading.main}55`,
                            background: `${COLORS.reading.main}16`,
                            color: COLORS.reading.main,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "'Pretendard', sans-serif",
                          }}
                        >
                          + 기록
                        </button>
                        <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(book); }} />
                      </div>
                    </div>
                    {book.review && <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: "8px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>"{book.review}"</p>}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {book.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.reading.main} />)}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))}
        </div>
      ) : (
        <div key="reading-grid" style={{ animation: "viewSwitch 0.28s ease-out" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${getResponsiveColumns(layout, { phone: 1, tablet: 2, desktop: 3 })}, minmax(0, 1fr))`, gap: 12 }}>
            {books.map((book, idx) => (
              <div
                key={book.id}
                style={{
                  animation: "cardStaggerIn 0.32s ease-out both",
                  animationDelay: `${Math.min(idx * 45, 220)}ms`,
                }}
              >
                <ReadingGridCard book={book} onEdit={onEdit} onAdd={openProgressModal} onOpen={() => setDetailId(book.id)} layout={layout} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    <ReadingProgressModal
      book={progressModalBook}
      layout={layout}
      saving={savingProgress}
      error={progressError}
      currentPages={currentPageInput}
      totalPages={totalPageInput}
      note={noteInput}
      onCurrentPagesChange={(value) => {
        setCurrentPageInput(value);
        setProgressError("");
      }}
      onTotalPagesChange={(value) => {
        setTotalPageInput(value);
        setProgressError("");
      }}
      onNoteChange={(value) => {
        setNoteInput(value);
        setProgressError("");
      }}
      onClose={closeProgressModal}
      onSubmit={submitProgressModal}
    />
    </>
  );
};

/* ──────────── Page: Study ──────────── */
export const StudyPage = ({ studies, loading, onEdit, layout }) => {
  const [detailId, setDetailId] = useState(null);
  const detail = studies.find(s => s.id === detailId);
  if (detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => setDetailId(null)} style={{
            background: "none", border: "none", color: COLORS.study.main, fontSize: 13,
            fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "'Pretendard', sans-serif",
          }}>← 뒤로</button>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>{detail.title}</h3>
        {detail.imageUrl && (
          <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.03)" }}>
            <img src={detail.imageUrl} alt={`${detail.title} 이미지`} style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ProgressBar value={detail.progress} color={COLORS.study.main} height={8} />
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.study.main, fontFamily: "'Outfit', sans-serif" }}>{detail.progress}%</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge text={detail.goal} color={COLORS.study.main} />
          {detail.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.study.main} />)}
        </div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark.textMuted, margin: "8px 0 4px", fontFamily: "'Outfit', sans-serif" }}>학습 목차</h4>
        <StudyAccordion study={detail} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconActionButton onClick={() => onEdit(detail)} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <PenIcon size={20} color={COLORS.study.main} /> 공부 기록
      </h3>
      {!loading && studies.length === 0 && (
        <GlassCard>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>공부 기록이 없습니다.</p>
        </GlassCard>
      )}
      <div style={{ display: "grid", gridTemplateColumns: layout.isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 16 }}>
        {studies.map(s => (
          <GlassCard key={s.id} glow={COLORS.study.glow} style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setDetailId(s.id)}>
            <div style={{ display: "flex", flexDirection: layout.isPhone ? "column" : "row", gap: 16 }}>
            {s.imageUrl && (
              <div style={{
                width: 60, height: 84, borderRadius: 10, flexShrink: 0, overflow: "hidden",
                border: `1px solid ${COLORS.study.main}22`,
                background: `linear-gradient(135deg, ${COLORS.study.main}33, ${COLORS.study.main}11)`,
              }}>
                <img src={s.imageUrl} alt={`${s.title} 이미지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 4px", fontFamily: "'Pretendard', sans-serif" }}>{s.title}</h4>
                  <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: 0 }}>{s.goal} · {s.chapters.length}개 챕터</p>
                </div>
                <span style={{ display: "inline-block", fontSize: 22, fontWeight: 800, color: COLORS.study.main, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
                  {s.progress}%
                </span>
              </div>
              <ProgressBar value={s.progress} color={COLORS.study.main} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginTop: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {s.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.study.main} />)}
                </div>
                <IconActionButton onClick={(e) => { e.stopPropagation(); onEdit(s); }} />
              </div>
            </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

/* ──────────── Page: Culture ──────────── */
export const CulturePage = ({ items, loading, onEdit, onUpdateSeriesProgress, layout, title = "문화생활", fixedType = null }) => {
  const [filter, setFilter] = useState(fixedType || "전체");
  const [detailId, setDetailId] = useState(null);
  const filters = ["전체", ...CULTURE_TYPES];

  useEffect(() => {
    if (fixedType) setFilter(fixedType);
  }, [fixedType]);

  useEffect(() => {
    setDetailId(null);
  }, [fixedType]);

  const filtered = useMemo(() => {
    if (fixedType) return items.filter((item) => item.type === fixedType);
    return filter === "전체" ? items : items.filter((item) => item.type === filter);
  }, [filter, fixedType, items]);

  const detailItem = useMemo(
    () => filtered.find((item) => item.id === detailId) || null,
    [detailId, filtered]
  );

  if (detailItem?.type === "시리즈") {
    return <SeriesDetailPage item={detailItem} layout={layout} onBack={() => setDetailId(null)} onEdit={onEdit} onUpdateSeriesProgress={onUpdateSeriesProgress} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <FilmIcon size={20} color={COLORS.culture.main} /> {title}
      </h3>
      {!fixedType && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} style={{
              padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${filter === item ? COLORS.culture.main : COLORS.dark.border}`,
              background: filter === item ? `${COLORS.culture.main}15` : "transparent",
              color: filter === item ? COLORS.culture.main : COLORS.dark.textMuted,
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Pretendard', sans-serif",
            }}>{item}</button>
          ))}
        </div>
      )}
      {/* poster grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${getResponsiveColumns(layout, { phone: 1, tablet: 2, desktop: 3 })}, minmax(0, 1fr))`, gap: 12 }}>
        {!loading && filtered.length === 0 && (
          <GlassCard style={{ gridColumn: "1 / -1" }}>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>문화 기록이 없습니다.</p>
          </GlassCard>
        )}
        {filtered.map(c => {
          const tone = getCultureTone(c.type);
          const accent = tone.main;
          const glow = tone.glow;
          const isSeries = c.type === "시리즈";
          const posterNode = c.poster ? (
            <img
              src={c.poster}
              alt={`${c.title} 포스터`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : c.type === "게임" ? (
            <GamepadIcon size={36} color={`${accent}88`} />
          ) : (
            <FilmIcon size={36} color={`${accent}88`} />
          );
          return (
          <GlassCard
            key={c.id}
            glow={glow}
            style={{ padding: 0, overflow: "hidden", cursor: isSeries ? "pointer" : "default" }}
            onClick={isSeries ? () => setDetailId(c.id) : undefined}
          >
            {isSeries ? (
              <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "96px minmax(0, 1fr)" : "110px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
                  <div style={{
                    position: "relative",
                    aspectRatio: "2 / 3",
                    borderRadius: 18,
                    overflow: "hidden",
                    border: `1px solid ${accent}24`,
                    background: c.poster
                      ? `linear-gradient(155deg, rgba(255,255,255,0.05), ${accent}18)`
                      : `linear-gradient(160deg, ${accent}25, ${COLORS.dark.surfaceSolid})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 18px 36px rgba(0,0,0,0.2)",
                  }}>
                    {posterNode}
                  </div>
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <StatusBadge status={c.status} />
                      <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(c); }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{
                        fontSize: 18,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        color: COLORS.dark.text,
                        margin: "0 0 6px",
                        fontFamily: "'Outfit', sans-serif",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {c.title}
                      </h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <SeriesPlatformBadge platformKey={c.platformKey} platformLabel={c.platformLabel} accent={accent} />
                        {c.rating > 0 && <RatingStars rating={c.rating} size={12} />}
                      </div>
                    </div>
                    <SeriesProgressSummary item={c} accent={accent} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.tags.map(t => <Badge key={t} text={`#${t}`} color={accent} />)}
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  height: 160, background: c.poster ? COLORS.dark.surfaceSolid : `linear-gradient(160deg, ${accent}25, ${COLORS.dark.surfaceSolid})`,
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                }}>
                  {posterNode}
                  <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={c.status} /></div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 4px", fontFamily: "'Pretendard', sans-serif", flex: 1 }}>{c.title}</h4>
                    <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(c); }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{c.type}</span>
                    {c.playtime && <span style={{ fontSize: 11, color: accent }}>· {c.playtime}</span>}
                  </div>
                  {c.rating > 0 && <RatingStars rating={c.rating} size={12} />}
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {c.tags.map(t => <Badge key={t} text={`#${t}`} color={accent} />)}
                  </div>
                </div>
              </>
            )}
          </GlassCard>
        )})}
      </div>
    </div>
  );
};

export const RecordAreaCard = ({ section, onSelect, layout, columns = 2 }) => {
  const secondaryText = section.description;
  const isSingleColumn = columns === 1;
  const previewWidth = isSingleColumn ? 88 : layout.isPhone ? 58 : 64;
  const previewHeight = isSingleColumn ? 120 : layout.isPhone ? 80 : 88;
  const previewStep = isSingleColumn ? 42 : layout.isPhone ? 28 : 32;
  const footerHeight = isSingleColumn ? 122 : layout.isPhone ? 84 : 92;
  const latestTitles = section.previews.slice(0, 3).map((preview) => preview.title);
  const remainingCount = section.count - latestTitles.length;
  const previewDisplayOrder = section.previews.length >= 3
    ? [1, 0, 2]
    : section.previews.length === 2
      ? [1, 0]
      : [0];
  const arrangedPreviews = previewDisplayOrder
    .map((previewIndex) => section.previews[previewIndex])
    .filter(Boolean);
  const previewRotations = [-7, 0, 7];
  const previewBottomOffsets = isSingleColumn ? [-26, -20, -26] : [-18, -12, -18];
  const previewZIndexes = [2, 3, 1];

  return (
    <button
      type="button"
      onClick={() => onSelect(section.key)}
      style={{
        width: "100%",
        minHeight: isSingleColumn ? 222 : layout.isPhone ? 188 : 208,
        padding: layout.isPhone ? "14px" : "16px",
        borderRadius: 22,
        border: `1px solid ${section.accent}2e`,
        background: `radial-gradient(circle at top right, ${section.accent}26 0, transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.04), ${section.accent}12)`,
        boxShadow: `0 14px 28px ${section.accent}14`,
        textAlign: "left",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, position: "relative" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: layout.isPhone ? 38 : 42,
            height: layout.isPhone ? 38 : 42,
            borderRadius: 14,
            background: `${section.accent}1c`,
            border: `1px solid ${section.accent}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: section.accent,
            flexShrink: 0,
          }}>
            {section.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 16, color: COLORS.dark.text, fontWeight: 800, fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{section.label}</p>
            <p style={{
              margin: 0,
              fontSize: 12,
              color: COLORS.dark.textMuted,
              fontWeight: 500,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {secondaryText}
            </p>
          </div>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2, whiteSpace: "nowrap" }}>
            <span style={{
              display: "inline-block",
              fontSize: isSingleColumn ? 30 : layout.isPhone ? 24 : 26,
              lineHeight: 1,
              fontWeight: 800,
              color: COLORS.dark.text,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {section.count}
            </span>
            <span style={{
              display: "inline-block",
              fontSize: isSingleColumn ? 15 : 13,
              lineHeight: 1,
              fontWeight: 800,
              color: section.accent,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {section.unit}
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", height: footerHeight }}>
        {arrangedPreviews.map((preview, index) => (
          <div
            key={`${section.key}-${preview.id}`}
            style={{
              position: "absolute",
              left: `${index * previewStep}px`,
              bottom: previewBottomOffsets[index] ?? previewBottomOffsets[0],
              width: previewWidth,
              height: previewHeight,
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${section.accent}2c`,
              background: COLORS.dark.surfaceSolid,
              boxShadow: "0 10px 20px rgba(0,0,0,0.24)",
              transform: `rotate(${previewRotations[index] ?? 0}deg)`,
              zIndex: previewZIndexes[index] ?? 1,
            }}
          >
            {preview.image ? (
              <img src={preview.image} alt={preview.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: section.accent,
                background: `linear-gradient(150deg, ${COLORS.dark.surfaceSolid}, ${section.accent}28)`,
              }}>
                {preview.icon}
              </div>
            )}
          </div>
        ))}
        {section.previews.length === 0 && (
          <div style={{
            position: "absolute",
            left: 0,
            bottom: isSingleColumn ? -10 : -6,
            width: isSingleColumn ? 74 : layout.isPhone ? 62 : 68,
            height: isSingleColumn ? 74 : layout.isPhone ? 62 : 68,
            borderRadius: 18,
            border: `1px dashed ${section.accent}42`,
            background: `${section.accent}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: section.accent,
          }}>
            {section.icon}
          </div>
        )}
        {isSingleColumn && (
          <div style={{
            position: "absolute",
            right: 0,
            bottom: 8,
            width: "42%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            textAlign: "right",
            paddingRight: 8,
          }}>
            {latestTitles.map((title, index) => (
              <span
                key={`${section.key}-title-${index}`}
                style={{
                  fontSize: 13,
                  lineHeight: 1.35,
                  color: index === 0
                    ? COLORS.dark.text
                    : index === 1
                      ? "rgba(245,240,235,0.74)"
                      : COLORS.dark.textMuted,
                  opacity: index === 0 ? 1 : index === 1 ? 0.9 : 0.72,
                  filter: index === 0 ? "none" : `blur(${0.15 + index * 0.18}px)`,
                  textShadow: "0 0 10px rgba(255,255,255,0.06)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                }}
              >
                {title}
              </span>
            ))}
            {remainingCount > 0 && (
              <span style={{
                fontSize: 12,
                lineHeight: 1.35,
                color: "rgba(160,152,144,0.78)",
                opacity: 0.62,
                filter: "blur(0.85px)",
                textShadow: "0 0 12px rgba(255,255,255,0.05)",
              }}>
                {`그리고 ${remainingCount}건의 기록들`}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
};

export const RecordsPage = ({ readingLogs, studyLogs, cultureLogs, loading, onEditReading, onEditStudy, onEditCulture, onUpdateSeriesProgress, onAddReading, initialSection = null, onSectionChange, layout }) => {
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const [mobileColumns, setMobileColumns] = useState(1);
  const [transitionDirection, setTransitionDirection] = useState(initialSection ? "forward" : "back");
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const transitionTimeoutRef = useRef(null);
  const transitionFrameRef = useRef(null);
  const requestedSectionRef = useRef(initialSection || null);

  const clearSectionTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (transitionFrameRef.current) {
      cancelAnimationFrame(transitionFrameRef.current);
      transitionFrameRef.current = null;
    }
  }, []);

  const startSectionTransition = useCallback((nextSection) => {
    const normalizedSection = nextSection || null;
    if (normalizedSection === selectedSection && transitionPhase === "idle") return;

    clearSectionTransition();
    const direction = normalizedSection ? "forward" : "back";
    setTransitionDirection(direction);
    setTransitionPhase("exit");

    transitionTimeoutRef.current = window.setTimeout(() => {
      setSelectedSection(normalizedSection);
      setTransitionPhase("enter-pre");
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionPhase("enter");
        transitionTimeoutRef.current = window.setTimeout(() => {
          setTransitionPhase("idle");
          transitionTimeoutRef.current = null;
        }, 280);
      });
    }, 170);
  }, [clearSectionTransition, selectedSection, transitionPhase]);

  useEffect(() => {
    return () => clearSectionTransition();
  }, [clearSectionTransition]);

  useEffect(() => {
    const normalizedSection = initialSection || null;
    if (normalizedSection === requestedSectionRef.current) return;
    requestedSectionRef.current = normalizedSection;
    startSectionTransition(normalizedSection);
  }, [initialSection, startSectionTransition]);

  useEffect(() => {
    if (!layout.isPhone) return;
    if (layout.width < 360 && mobileColumns !== 1) {
      setMobileColumns(1);
    }
  }, [layout.isPhone, layout.width, mobileColumns]);

  const recordHubColumns = layout.isPhone ? mobileColumns : 2;

  const sortedReading = useMemo(() => [...readingLogs].sort((a, b) => new Date(b.date) - new Date(a.date)), [readingLogs]);
  const sortedStudy = useMemo(() => [...studyLogs].sort((a, b) => new Date(b.date) - new Date(a.date)), [studyLogs]);
  const movieLogs = useMemo(() => cultureLogs.filter((item) => item.type === "영화").sort((a, b) => new Date(b.date) - new Date(a.date)), [cultureLogs]);
  const seriesLogs = useMemo(() => cultureLogs.filter((item) => item.type === "시리즈").sort((a, b) => new Date(b.date) - new Date(a.date)), [cultureLogs]);
  const gameLogs = useMemo(() => cultureLogs.filter((item) => item.type === "게임").sort((a, b) => new Date(b.date) - new Date(a.date)), [cultureLogs]);

  const sections = useMemo(() => ([
    {
      order: 0,
      key: "reading",
      label: "독서",
      description: "표지와 진행률",
      count: sortedReading.length,
      latestUpdatedAt: sortedReading[0]?.date ? new Date(sortedReading[0].date).getTime() : 0,
      unit: "권",
      accent: COLORS.reading.main,
      icon: <BookIcon color={COLORS.reading.main} />,
      previews: sortedReading.slice(0, 3).map((book) => ({
        id: book.id,
        title: book.title,
        image: book.cover,
        icon: <BookIcon color={COLORS.reading.main} />,
      })),
    },
    {
      order: 1,
      key: "study",
      label: "공부",
      description: "진척률과 챕터",
      count: sortedStudy.length,
      latestUpdatedAt: sortedStudy[0]?.date ? new Date(sortedStudy[0].date).getTime() : 0,
      unit: "개",
      accent: COLORS.study.main,
      icon: <PenIcon color={COLORS.study.main} />,
      previews: sortedStudy.slice(0, 3).map((study) => ({
        id: study.id,
        title: study.title,
        image: study.imageUrl,
        icon: <PenIcon color={COLORS.study.main} />,
      })),
    },
    {
      order: 2,
      key: "movie",
      label: "영화",
      description: "포스터와 평점",
      count: movieLogs.length,
      latestUpdatedAt: movieLogs[0]?.date ? new Date(movieLogs[0].date).getTime() : 0,
      unit: "편",
      accent: COLORS.movie.main,
      icon: <FilmIcon color={COLORS.movie.main} />,
      previews: movieLogs.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        image: item.poster,
        icon: <FilmIcon color={COLORS.movie.main} />,
      })),
    },
    {
      order: 3,
      key: "series",
      label: "시리즈",
      description: "회차와 상태",
      count: seriesLogs.length,
      latestUpdatedAt: seriesLogs[0]?.date ? new Date(seriesLogs[0].date).getTime() : 0,
      unit: "편",
      accent: COLORS.series.main,
      icon: <FilmIcon color={COLORS.series.main} />,
      previews: seriesLogs.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        image: item.poster,
        icon: <FilmIcon color={COLORS.series.main} />,
      })),
    },
    {
      order: 4,
      key: "game",
      label: "게임",
      description: "플레이 시간",
      count: gameLogs.length,
      latestUpdatedAt: gameLogs[0]?.date ? new Date(gameLogs[0].date).getTime() : 0,
      unit: "개",
      accent: COLORS.game.main,
      icon: <GamepadIcon color={COLORS.game.main} />,
      previews: gameLogs.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        image: item.poster,
        icon: <GamepadIcon color={COLORS.game.main} />,
      })),
    },
  ].sort((a, b) => {
    if (b.latestUpdatedAt !== a.latestUpdatedAt) return b.latestUpdatedAt - a.latestUpdatedAt;
    return a.order - b.order;
  })), [gameLogs, movieLogs, seriesLogs, sortedReading, sortedStudy]);

  const activeSection = sections.find((section) => section.key === selectedSection) || null;
  const mobileColumnOptions = [
    { value: 1, label: "1열", icon: <ListIcon size={16} /> },
    { value: 2, label: "2열", icon: <GridIcon size={16} /> },
  ];

  const handleSectionChange = (nextSection) => {
    const normalizedSection = nextSection || null;
    requestedSectionRef.current = normalizedSection;
    startSectionTransition(normalizedSection);
    onSectionChange?.(normalizedSection);
  };

  const getSectionPaneStyle = () => {
    const easing = "280ms cubic-bezier(.22,.9,.24,1)";
    if (transitionPhase === "exit") {
      return {
        opacity: 0,
        transform: `translate3d(${transitionDirection === "forward" ? "-26px" : "26px"}, 0, 0) scale(0.988)`,
        pointerEvents: "none",
        transition: `opacity ${easing}, transform ${easing}`,
      };
    }
    if (transitionPhase === "enter-pre") {
      return {
        opacity: 0,
        transform: `translate3d(${transitionDirection === "forward" ? "30px" : "-30px"}, 0, 0) scale(0.992)`,
        pointerEvents: "none",
      };
    }
    if (transitionPhase === "enter") {
      return {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        transition: `opacity ${easing}, transform ${easing}`,
      };
    }
    return {
      opacity: 1,
      transform: "none",
    };
  };

  const renderSectionPage = () => {
    switch (selectedSection) {
      case "reading":
        return <ReadingPage books={sortedReading} loading={loading} onEdit={onEditReading} onAdd={onAddReading} layout={layout} />;
      case "study":
        return <StudyPage studies={sortedStudy} loading={loading} onEdit={onEditStudy} layout={layout} />;
      case "movie":
        return <CulturePage items={movieLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} layout={layout} title="영화 기록" fixedType="영화" />;
      case "series":
        return <CulturePage items={seriesLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} layout={layout} title="시리즈 기록" fixedType="시리즈" />;
      case "game":
        return <CulturePage items={gameLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} layout={layout} title="게임 기록" fixedType="게임" />;
      default:
        return null;
    }
  };

  if (selectedSection) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, willChange: transitionPhase === "idle" ? "auto" : "transform, opacity", ...getSectionPaneStyle() }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => handleSectionChange(null)}
            style={{
              alignSelf: "flex-start",
              minHeight: 42,
              padding: "0 14px",
              borderRadius: 999,
              border: `1px solid ${COLORS.dark.border}`,
              background: "rgba(255,255,255,0.03)",
              color: COLORS.dark.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Pretendard', sans-serif",
            }}
          >
            ← 기록 허브
          </button>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: activeSection?.accent || COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Records</p>
            <h2 style={{ margin: 0, fontSize: layout.isPhone ? 24 : 30, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>{activeSection?.label}</h2>
          </div>
        </div>
        {renderSectionPage()}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, willChange: transitionPhase === "idle" ? "auto" : "transform, opacity", ...getSectionPaneStyle() }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Records</p>
          <h2 style={{ margin: 0, fontSize: layout.isPhone ? 24 : 30, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>기록 허브</h2>
        </div>
        {layout.isPhone ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingTop: 2 }}>
            {mobileColumnOptions.map((option) => {
              const active = recordHubColumns === option.value;
              const disabled = option.value === 2 && layout.width < 360;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !disabled && setMobileColumns(option.value)}
                  disabled={disabled}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: `1px solid ${active ? `${COLORS.reading.main}66` : COLORS.dark.border}`,
                    background: active ? `${COLORS.reading.main}16` : "rgba(255,255,255,0.03)",
                    color: disabled ? `${COLORS.dark.textMuted}66` : active ? COLORS.reading.main : COLORS.dark.textMuted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                  }}
                  aria-label={`${option.label} 보기`}
                  title={`${option.label} 보기`}
                >
                  {option.icon}
                </button>
              );
            })}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>영역 선택</p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${recordHubColumns}, minmax(0, 1fr))`, gap: layout.isPhone ? 12 : 14 }}>
        {sections.map((section, index) => (
          <div
            key={section.key}
            style={{
              animation: "cardStaggerIn 0.32s ease-out both",
              animationDelay: `${Math.min(index * 40, 180)}ms`,
            }}
          >
            <RecordAreaCard section={section} onSelect={handleSectionChange} layout={layout} columns={recordHubColumns} />
          </div>
        ))}
      </div>
    </div>
  );
};
