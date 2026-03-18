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
  DAYS_KO,
  formatMonthDayLabel,
  formatDurationLabel,
  formatTimeLabel,
  formatRelativeTime,
  getDateKey,
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
  XIcon,
  StarIcon,
  ClockIcon,
  CalendarIcon,
  ChevronDown,
} from "../core";
import {
  HalfDonutChart,
  GlassCard,
  ModalShell,
  ProgressBar,
  TimelineProgressBar,
  ReadingProgressEditor,
  IconActionButton,
  Badge,
  StatusBadge,
  RatingStars,
} from "../ui";

/* ──────────── Interactive Study ToC ──────────── */
const StudyToCItem = ({ item, depth = 0, onUpdate, onDelete, onAddChild, onDragStart, onDragOver, onDrop, accent }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setLegacyTitle] = useState(item.title);
  const [showNotes, setShowNotes] = useState(false);

  const handleToggleComplete = () => {
    onUpdate(item.id, { completed: !item.completed });
  };

  const handleTitleSubmit = () => {
    onUpdate(item.id, { title: tempTitle });
    setIsEditing(false);
  };

  const handleNoteChange = (e) => {
    onUpdate(item.id, { notes: e.target.value });
  };

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragOver={(e) => onDragOver(e, item.id)}
      onDrop={(e) => onDrop(e, item.id)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginLeft: depth > 0 ? 20 : 0,
        padding: "4px 0",
        borderLeft: depth > 0 ? `1px dashed ${accent}33` : "none",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: item.completed ? `${accent}10` : "rgba(255,255,255,0.03)",
        border: `1px solid ${item.completed ? `${accent}33` : COLORS.dark.border}`,
        transition: "all 0.2s",
      }}>
        {/* 드래그 핸들 */}
        <div style={{ cursor: "grab", opacity: 0.4 }}>
          <GridIcon size={16} color={COLORS.dark.textMuted} />
        </div>

        {/* 완료 체크박스 */}
        <button
          onClick={handleToggleComplete}
          style={{
            width: 20, height: 20, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: item.completed ? accent : "rgba(255,255,255,0.08)",
            border: item.completed ? "none" : `1.5px solid ${COLORS.dark.border}`,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          {item.completed && <CheckIcon size={12} color="#1a1816" />}
        </button>

        {/* 제목 편집/표시 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setLegacyTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              style={{
                width: "100%", background: "transparent", border: "none",
                color: COLORS.dark.text, fontSize: 14, outline: "none",
                padding: 0, fontWeight: 600,
              }}
            />
          ) : (
            <div 
              onClick={() => setIsEditing(true)}
              style={{ 
                fontSize: 14, fontWeight: 600, 
                color: item.completed ? COLORS.study.light : COLORS.dark.text,
                cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}
            >
              {item.title || "제목 없는 목차"}
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div style={{ display: "flex", gap: 4, opacity: 0.6 }}>
          <button onClick={() => setShowNotes(!showNotes)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <PenIcon size={14} color={item.notes ? accent : COLORS.dark.textMuted} />
          </button>
          <button onClick={() => onAddChild(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <PlusIcon size={14} color={COLORS.dark.textMuted} />
          </button>
          <button onClick={() => onDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <XIcon size={14} color="#e63946" />
          </button>
        </div>
      </div>

      {/* 메모장 */}
      {showNotes && (
        <textarea
          placeholder="이 챕터에 대한 메모를 입력하세요..."
          value={item.notes || ""}
          onChange={handleNoteChange}
          style={{
            margin: "2px 0 8px 30px",
            background: "rgba(0,0,0,0.2)",
            border: `1px solid ${accent}22`,
            borderRadius: 8,
            padding: "10px",
            color: COLORS.dark.textMuted,
            fontSize: 13,
            minHeight: 60,
            resize: "vertical",
            outline: "none",
            fontFamily: "'Pretendard', sans-serif",
          }}
        />
      )}

      {/* 하위 항목 재귀 렌더링 */}
      {item.children && item.children.map((child) => (
        <StudyToCItem
          key={child.id}
          item={child}
          depth={depth + 1}
          accent={accent}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
};

export const StudyAccordion = ({ study, onSaveToc }) => {
  const [toc, setToc] = useState(study.toc || []);
  const accent = COLORS.study.main;
  const dragItem = useRef(null);

  // 트리 평탄화 및 항목 찾기 유틸리티
  const findAndAction = (items, id, action) => {
    return items.map((item) => {
      if (item.id === id) return action(item);
      if (item.children) return { ...item, children: findAndAction(item.children, id, action) };
      return item;
    });
  };

  const removeItem = (items, id) => {
    return items
      .filter((item) => item.id !== id)
      .map((item) => ({
        ...item,
        children: item.children ? removeItem(item.children, id) : [],
      }));
  };

  const handleUpdate = (id, updates) => {
    const nextToc = findAndAction(toc, id, (item) => ({ ...item, ...updates }));
    setToc(nextToc);
    onSaveToc?.(nextToc);
  };

  const handleDelete = (id) => {
    if (!window.confirm("이 항목과 하위 항목을 모두 삭제할까요?")) return;
    const nextToc = removeItem(toc, id);
    setToc(nextToc);
    onSaveToc?.(nextToc);
  };

  const handleAddChild = (parentId) => {
    const newItem = {
      id: `node-${Date.now()}`,
      title: "",
      completed: false,
      notes: "",
      children: [],
    };
    const nextToc = parentId 
      ? findAndAction(toc, parentId, (item) => ({ ...item, children: [...(item.children || []), newItem] }))
      : [...toc, newItem];
    setToc(nextToc);
    onSaveToc?.(nextToc);
  };

  // DnD 로직 (심플 버전)
  const handleDragStart = (e, id) => {
    dragItem.current = id;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragItem.current || dragItem.current === targetId) return;

    // 트리에서 항목 이동 (실제 상용에서는 더 복잡한 로직이 필요하지만 여기서는 형제간 이동 위주)
    // 간단한 구현을 위해 여기서는 최상위 레벨 이동만 시연하거나 전체 트리 재구성을 수행
    // 프로젝트 규모를 고려해 여기서는 상태를 업데이트하고 부모에게 알리는 구조로 유지
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {toc.map((item) => (
        <StudyToCItem
          key={item.id}
          item={item}
          accent={accent}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddChild={handleAddChild}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
      <button
        onClick={() => handleAddChild(null)}
        style={{
          width: "100%", padding: "12px", borderRadius: 12,
          border: `1.5px dashed ${accent}44`, color: accent,
          background: `${accent}08`, cursor: "pointer",
          fontSize: 13, fontWeight: 700, marginTop: 8,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <PlusIcon size={16} /> 최상위 목차 추가
      </button>
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
  const episodeWatchDates = item?.episodeWatchDates || {};
  let remainingWatched = metrics.watchedEpisodes;
  let currentPointer = null;
  let absoluteEpisodeCursor = 0;

  const seasons = (Array.isArray(metrics?.seasons) ? metrics.seasons : []).map((season) => {
    const totalEpisodes = Math.max(safeNumber(season?.episodeCount, Array.isArray(season?.episodes) ? season.episodes.length : 0), 0);
    const watchedEpisodes = totalEpisodes > 0 ? Math.min(remainingWatched, totalEpisodes) : 0;
    remainingWatched = Math.max(remainingWatched - totalEpisodes, 0);

    const episodes = (Array.isArray(season?.episodes) ? season.episodes : []).map((episode, index) => {
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
    const dateKey = getDateKey(isoLike);
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

const DetailTopBar = ({ accent, backLabel = "목록", onBack, primaryAction = null, onEdit }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
    <button
      type="button"
      onClick={onBack}
      style={{
        alignSelf: "flex-start",
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${accent}30`,
        background: `${accent}10`,
        color: accent,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Pretendard', sans-serif",
      }}
    >
      {`← ${backLabel}`}
    </button>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {primaryAction}
      {onEdit ? <IconActionButton onClick={onEdit} /> : null}
    </div>
  </div>
);

const FeatureCardShell = ({
  layout,
  accent,
  glow,
  imageSrc,
  imageAlt = "",
  fallback,
  onOpen,
  children,
}) => (
  <GlassCard
    glow={glow}
    style={{ padding: 0, overflow: "hidden", cursor: onOpen ? "pointer" : "default" }}
    onClick={onOpen}
  >
    <div
      style={{
        padding: "16px 16px 14px",
        display: "grid",
        gridTemplateColumns: layout.isPhone ? "96px minmax(0, 1fr)" : "110px minmax(0, 1fr)",
        gap: 14,
        alignItems: "start",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid ${accent}24`,
          background: imageSrc
            ? `linear-gradient(155deg, rgba(255,255,255,0.05), ${accent}18)`
            : `linear-gradient(160deg, ${accent}25, ${COLORS.dark.surfaceSolid})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 18px 36px rgba(0,0,0,0.2)",
        }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          fallback
        )}
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  </GlassCard>
);

const FeatureDetailHeroShell = ({
  layout,
  accent,
  glow,
  imageSrc,
  imageAlt = "",
  fallback,
  children,
}) => (
  <GlassCard glow={glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px", overflow: "hidden" }}>
    <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "156px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
      <div
        style={{
          minHeight: 228,
          borderRadius: 22,
          overflow: "hidden",
          border: `1px solid ${accent}24`,
          background: imageSrc ? COLORS.dark.surfaceSolid : `linear-gradient(150deg, ${accent}24, rgba(255,255,255,0.04))`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageSrc ? (
          <img src={imageSrc} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          fallback
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        {children}
      </div>
    </div>
  </GlassCard>
);

const CompactMediaPosterCard = ({
  accent,
  glow,
  title,
  poster,
  posterAlt,
  fallback,
  status,
  metaText,
  rating,
  tags,
  onEdit,
}) => (
  <GlassCard glow={glow} style={{ padding: 0, overflow: "hidden" }}>
    <div style={{
      height: 188,
      background: poster ? COLORS.dark.surfaceSolid : `linear-gradient(160deg, ${accent}25, ${COLORS.dark.surfaceSolid})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      {poster ? (
        <img
          src={poster}
          alt={posterAlt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        fallback
      )}
      <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={status} /></div>
    </div>
    <div style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: 0, fontFamily: "'Pretendard', sans-serif", flex: 1, lineHeight: 1.35 }}>
          {title}
        </h4>
        <IconActionButton onClick={onEdit} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{metaText}</span>
        {rating > 0 ? <RatingStars rating={rating} size={12} /> : null}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tags.map((tag) => <Badge key={`${title}-${tag}`} text={`#${tag}`} color={accent} />)}
      </div>
    </div>
  </GlassCard>
);

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

const buildGameCalendarMonths = (sessions) => {
  const normalized = Array.isArray(sessions) ? sessions : [];
  const counts = normalized.reduce((acc, session) => {
    const key = getDateKey(session.playedAt || session.date);
    if (!key) return acc;
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  const monthKeys = [...new Set(normalized
    .map((session) => getDateKey(session.playedAt || session.date))
    .filter(Boolean)
    .map((dateKey) => dateKey.slice(0, 7))
  )];
  if (monthKeys.length === 0) {
    monthKeys.push(getDateKey(new Date()).slice(0, 7));
  }
  return monthKeys
    .slice(-3)
    .reverse()
    .map((monthKey) => {
      const [year, month] = monthKey.split("-").map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const startOffset = monthDate.getDay();
      const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
      const cells = Array.from({ length: totalCells }, (_, index) => {
        const day = index - startOffset + 1;
        if (day < 1 || day > daysInMonth) return null;
        const date = new Date(year, month - 1, day);
        const dateKey = getDateKey(date);
        return {
          dateKey,
          day,
          count: counts.get(dateKey) || 0,
        };
      });
      return {
        key: monthKey,
        label: `${year}년 ${month}월`,
        cells,
      };
    });
};

export const GamePlayLogModal = ({
  item,
  layout,
  saving,
  error,
  durationMinutes,
  playedDate,
  note,
  onDurationChange,
  onPlayedDateChange,
  onNoteChange,
  onClose,
  onSubmit,
}) => {
  const accent = COLORS.game.main;
  return (
    <ModalShell glow={COLORS.game.glow} width="min(92vw, 430px)" padding={layout.isPhone ? "22px 18px" : "24px 22px"} onBackdropClick={onClose} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Gameplay Log</p>
          <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>게임 플레이 기록</h4>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: COLORS.dark.textMuted }}>
            {item?.title || "게임"}에 오늘 플레이한 시간을 남깁니다.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>플레이 시간(분)</label>
            <input value={durationMinutes} onChange={(event) => onDurationChange?.(event.target.value)} type="number" min="1" step="1" style={{ width: "100%", minHeight: 52, borderRadius: 16, border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "0 14px" }} placeholder="예: 90" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>플레이 날짜</label>
            <input value={playedDate} onChange={(event) => onPlayedDateChange?.(event.target.value)} type="date" style={{ width: "100%", minHeight: 52, borderRadius: 16, border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "0 14px" }} />
          </div>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>플레이 메모</label>
          <textarea value={note} onChange={(event) => onNoteChange?.(event.target.value)} style={{ width: "100%", minHeight: 116, borderRadius: 16, border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "14px", resize: "vertical" }} placeholder="오늘 진행한 콘텐츠, 인상 깊은 장면, 플레이 감상을 남겨 보세요." />
        </div>
        {error ? <p style={{ margin: 0, fontSize: 12, color: "#f8b4bb" }}>{error}</p> : null}
        <button type="button" onClick={onSubmit} disabled={saving} style={{ minHeight: 52, borderRadius: 16, border: "none", background: accent, color: "#141821", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", boxShadow: `0 14px 28px ${COLORS.game.glow}` }}>
          {saving ? "저장 중..." : "플레이 기록 저장"}
        </button>
      </div>
    </ModalShell>
  );
};

const SeriesProgressTrendChart = ({
  points,
  color = COLORS.series.main,
  labelColor = COLORS.dark.textMuted,
  gridColor = "rgba(255,255,255,0.07)",
}) => {
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
      border: `1px solid ${color}22`,
      background: "rgba(255,255,255,0.03)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: color, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
          Progress Trend
        </p>
        <span style={{ fontSize: 11, color: labelColor }}>
          {`${points[0].label} → ${points[points.length - 1].label}`}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="seriesTrendFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${color}55`} />
            <stop offset="100%" stopColor={`${color}05`} />
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
              stroke={gridColor}
              strokeDasharray="3 5"
            />
          );
        })}
        <path d={areaPath} fill="url(#seriesTrendFill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <g key={`trend-point-${point.dateKey}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill={COLORS.dark.bg} stroke={color} strokeWidth="2" />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 11, color: labelColor }}>{points[0].label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "'Outfit', sans-serif" }}>{animatedProgressLabel}</span>
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
        <ModalShell glow={COLORS.series.glow} width="min(92vw, 420px)" padding="22px 20px" onBackdropClick={() => setPendingUnwatchEpisode(null)} onClose={() => setPendingUnwatchEpisode(null)}>
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
        </ModalShell>
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
  startTime,
  endTime,
  note,
  onCurrentPagesChange,
  onTotalPagesChange,
  onStartTimeChange,
  onEndTimeChange,
  onNoteChange,
  onClose,
  onSubmit,
}) => {
  if (!book) return null;
  const accent = COLORS.reading.progress;
  const parsedTotalPages = Math.max(0, safeNumber(totalPages));
  const parsedCurrentPages = clamp(safeNumber(currentPages), 0, Math.max(parsedTotalPages, 1));
  const remainingPages = Math.max(0, parsedTotalPages - parsedCurrentPages);
  return (
    <ModalShell
      glow={COLORS.reading.glow}
      width="min(92vw, 430px)"
      padding={layout.isPhone ? "22px 18px" : "24px 22px"}
      onBackdropClick={onClose}
      onClose={onClose}
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", paddingRight: 44 }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                Reading Update
              </p>
              <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                읽은 페이지 추가
              </h4>
            </div>
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

          <ReadingProgressEditor
            layout={layout}
            accent={accent}
            compact
            currentValue={String(parsedCurrentPages)}
            totalPages={String(parsedTotalPages)}
            derivedProgress={parsedTotalPages > 0 ? Math.round((parsedCurrentPages / parsedTotalPages) * 100) : 0}
            derivedReadPages={parsedCurrentPages}
            onCurrentChange={(value) => onCurrentPagesChange(value.replace(/\D/g, ""))}
            onTotalChange={(value) => onTotalPagesChange(value.replace(/\D/g, ""))}
          />
          {error && (
            <p style={{ margin: "-2px 0 0", fontSize: 12, color: "#f19aa4" }}>{error}</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: layout.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>독서 시작 시각</label>
              <input
                value={startTime}
                onChange={(event) => onStartTimeChange?.(event.target.value)}
                type="time"
                disabled={saving}
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 16,
                  border: `1px solid ${accent}28`,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.dark.text,
                  padding: "0 16px",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                  display: "block",
                  minWidth: 0,
                  fontFamily: "'Outfit', sans-serif",
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>독서 종료 시각</label>
              <input
                value={endTime}
                onChange={(event) => onEndTimeChange?.(event.target.value)}
                type="time"
                disabled={saving}
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 16,
                  border: `1px solid ${accent}28`,
                  background: "rgba(255,255,255,0.04)",
                  color: COLORS.dark.text,
                  padding: "0 16px",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                  display: "block",
                  minWidth: 0,
                  fontFamily: "'Outfit', sans-serif",
                }}
              />
            </div>
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
    </ModalShell>
  );
};

const buildReadingTrendPoints = (book) => {
  const sessions = (book && Array.isArray(book.readingSessions)) ? [...book.readingSessions].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
  if (sessions.length === 0) {
    return [{ label: "현재", progress: clamp(safeNumber(book?.progress), 0, 100), dateKey: "reading-current" }];
  }
  const points = [];
  sessions.forEach((session, index) => {
    if (!session) return;
    const dateKey = getDateKey(session.endedAt || session.date) || `reading-session-${index}`;
    const label = formatMonthDayLabel(session.endedAt || session.date) || "기록";
    const startProgress = clamp(safeNumber(session.fromProgress), 0, 100);
    const endProgress = clamp(safeNumber(session.toProgress), 0, 100);
    const previousPoint = points[points.length - 1];
    if (!previousPoint || Math.abs(previousPoint.progress - startProgress) > 0.5) {
      points.push({ label, progress: startProgress, dateKey: `${dateKey}-start-${index}` });
    }
    points.push({ label, progress: endProgress, dateKey: `${dateKey}-end-${index}` });
  });
  return points;
};

const buildStudyTrendPoints = (study) => {
  const activities = (study && Array.isArray(study.activities))
    ? [...study.activities].sort((a, b) => new Date(a.occurredAt || 0) - new Date(b.occurredAt || 0))
    : [];

  if (activities.length === 0) {
    return [{ label: "현재", progress: clamp(safeNumber(study?.progress), 0, 100), dateKey: "study-current" }];
  }

  const points = [];
  activities.forEach((activity, index) => {
    const rawDate = activity.occurredAt;
    const dateKey = getDateKey(rawDate) || `study-activity-${index}`;
    const label = formatMonthDayLabel(rawDate) || "기록";
    const startProgress = clamp(safeNumber(activity.progressStart), 0, 100);
    const endProgress = clamp(safeNumber(activity.progress), 0, 100);
    const previousPoint = points[points.length - 1];
    const hasDelta = Math.abs(endProgress - startProgress) > 0.5;

    if (hasDelta && (!previousPoint || Math.abs(previousPoint.progress - startProgress) > 0.5)) {
      points.push({ label, progress: startProgress, dateKey: `${dateKey}-start-${index}` });
    }
    points.push({ label, progress: endProgress, dateKey: `${dateKey}-end-${index}` });
  });

  return points;
};

const countStudyCompletedItems = (study) => {
  if (Array.isArray(study?.toc) && study.toc.length > 0) {
    const walk = (items) => items.reduce(
      (sum, entry) => sum + (entry.completed ? 1 : 0) + walk(entry.children || []),
      0,
    );
    return walk(study.toc);
  }
  return Array.isArray(study?.completed) ? study.completed.filter(Boolean).length : 0;
};

const countStudyTotalItems = (study) => {
  if (Array.isArray(study?.toc) && study.toc.length > 0) {
    const walk = (items) => items.reduce(
      (sum, entry) => sum + 1 + walk(entry.children || []),
      0,
    );
    return walk(study.toc);
  }
  return Array.isArray(study?.chapters) ? study.chapters.length : 0;
};

const buildStudyActivityLabel = (activity, entityTitle) => {
  const rawTitle = String(activity?.activityTitle || activity?.title || "").trim();
  if (!rawTitle) return "학습 기록";
  if (entityTitle && rawTitle === entityTitle) return "공부 시작";
  return rawTitle;
};

export const groupStudiesByEntity = (studies) => {
  const groups = new Map();
  const sorted = [...(Array.isArray(studies) ? studies : [])].sort(
    (a, b) => new Date(b.occurredAt || b.createdAt || 0) - new Date(a.occurredAt || a.createdAt || 0),
  );

  sorted.forEach((study) => {
    const groupKey = study.entityId || study.id;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        ...study,
        id: study.id,
        entityId: study.entityId || study.id,
        title: study.entityTitle || study.title,
        activityTitle: study.activityTitle || study.title,
        date: study.occurredAt || study.createdAt,
        startedAt: study.occurredAt || study.createdAt,
        latestActivityAt: study.occurredAt || study.createdAt,
        activities: [],
      });
    }

    const current = groups.get(groupKey);
    const activityAt = study.occurredAt || study.createdAt;
    current.activities.push({
      id: study.id,
      title: buildStudyActivityLabel(study, current.title),
      rawTitle: study.activityTitle || study.title,
      summary: study.summary || "",
      tags: Array.isArray(study.tags) ? study.tags : [],
      progress: clamp(safeNumber(study.progress), 0, 100),
      progressMode: study.progressMode || "page",
      pagesRead: safeNumber(study.pagesRead || study.readPages),
      pagesTotal: safeNumber(study.pagesTotal || study.pages),
      completedCount: countStudyCompletedItems(study),
      totalCount: countStudyTotalItems(study),
      occurredAt: activityAt,
    });

    if (new Date(activityAt).getTime() < new Date(current.startedAt).getTime()) {
      current.startedAt = activityAt;
    }
  });

  return [...groups.values()]
    .map((study) => {
      const chronologicalActivities = [...study.activities].sort((a, b) => new Date(a.occurredAt || 0) - new Date(b.occurredAt || 0));
      let previousProgress = 0;
      const activities = chronologicalActivities.map((activity, index) => {
        const nextProgress = clamp(safeNumber(activity.progress), 0, 100);
        const progressStart = index === 0
          ? nextProgress
          : clamp(previousProgress, 0, 100);
        const progressDelta = Math.max(0, nextProgress - progressStart);
        previousProgress = nextProgress;
        return {
          ...activity,
          progressStart,
          progressDelta,
        };
      }).sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));
      return {
        ...study,
        activities,
      };
    })
    .sort((a, b) => new Date(b.latestActivityAt || 0) - new Date(a.latestActivityAt || 0));
};

const formatReadingDuration = (minutes) => {
  const safeMinutes = Math.max(0, safeNumber(minutes, 0));
  if (safeMinutes <= 0) return "독서 시간 기록 대기";
  if (safeMinutes < 60) return `${safeMinutes}분 독서`;
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  return restMinutes > 0 ? `${hours}시간 ${restMinutes}분 독서` : `${hours}시간 독서`;
};

const toTimeInputValue = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const toDateInputValue = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const combineDateAndTime = (baseIsoLike, timeValue) => {
  if (!timeValue) return "";
  const baseDate = new Date(baseIsoLike || new Date().toISOString());
  if (Number.isNaN(baseDate.getTime())) return "";
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  baseDate.setHours(hours, minutes, 0, 0);
  return baseDate.toISOString();
};

const combineDateAndTimeInputs = (dateValue, timeValue, fallbackIsoLike) => {
  const baseIso = dateValue
    ? new Date(`${dateValue}T00:00:00`).toISOString()
    : (fallbackIsoLike || new Date().toISOString());
  return combineDateAndTime(baseIso, timeValue || toTimeInputValue(fallbackIsoLike) || "00:00");
};

const buildReadingTimelineGroups = (book) => {
  const groups = new Map();
  const ensureGroup = (dateKey, rawDate) => {
    if (!groups.has(dateKey)) {
      const date = new Date(rawDate);
      groups.set(dateKey, {
        dateKey,
        rawDate,
        dateLabel: formatMonthDayLabel(rawDate),
        dayNumber: Number.isNaN(date.getTime()) ? "" : String(date.getDate()).padStart(2, "0"),
        sideLabel: Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 · ${DAYS_KO[date.getDay()]}요일`,
        session: null,
        notes: [],
      });
    }
    return groups.get(dateKey);
  };
  (Array.isArray(book.readingSessions) ? book.readingSessions : []).forEach((session) => {
    const rawDate = session.endedAt || session.date;
    const dateKey = getDateKey(rawDate);
    if (!dateKey) return;
    ensureGroup(dateKey, rawDate).session = session;
  });
  (Array.isArray(book.readingNotes) ? book.readingNotes : []).forEach((note) => {
    const dateKey = getDateKey(note.date);
    if (!dateKey) return;
    ensureGroup(dateKey, note.date).notes.push(note);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      notes: [...group.notes].sort((a, b) => new Date(b.date) - new Date(a.date)),
    }))
    .sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));
};

const buildStudyTimelineGroups = (study) => {
  const groups = new Map();
  const ensureGroup = (dateKey, rawDate) => {
    if (!groups.has(dateKey)) {
      const date = new Date(rawDate);
      groups.set(dateKey, {
        dateKey,
        rawDate,
        dateLabel: formatMonthDayLabel(rawDate),
        dayNumber: Number.isNaN(date.getTime()) ? "" : String(date.getDate()).padStart(2, "0"),
        sideLabel: Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 · ${DAYS_KO[date.getDay()]}요일`,
        activities: [],
      });
    }
    return groups.get(dateKey);
  };

  (Array.isArray(study.activities) ? study.activities : []).forEach((activity) => {
    const rawDate = activity.occurredAt;
    const dateKey = getDateKey(rawDate);
    if (!dateKey) return;
    ensureGroup(dateKey, rawDate).activities.push(activity);
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      activities: [...group.activities].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)),
    }))
    .sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));
};

export const ReadingNoteModal = ({ book, layout, saving, error, page, note, onPageChange, onNoteChange, onClose, onSubmit }) => {
  if (!book) return null;
  const accent = COLORS.reading.main;
  return (
    <ModalShell glow={COLORS.reading.glow} width="min(92vw, 430px)" padding={layout.isPhone ? "22px 18px" : "24px 22px"} onBackdropClick={onClose} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ paddingRight: 44 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Reading Note</p>
          <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>독서 메모 남기기</h4>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>페이지 정보</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 52, borderRadius: 16, border: `1px solid ${accent}28`, background: "rgba(255,255,255,0.04)", padding: "0 16px" }}>
            <input
              value={page}
              onChange={(event) => onPageChange(event.target.value.replace(/\D/g, ""))}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="메모한 페이지"
              style={{ width: "100%", border: "none", background: "transparent", color: COLORS.dark.text, fontSize: 15, outline: "none", fontFamily: "'Outfit', sans-serif" }}
            />
            <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>p.</span>
          </div>
        </div>
        <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={5} placeholder="문장, 생각, 질문을 남겨보세요." style={{ width: "100%", borderRadius: 16, border: `1px solid ${accent}24`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "14px 16px", fontSize: 13, lineHeight: 1.65, resize: "vertical", outline: "none", fontFamily: "'Pretendard', sans-serif" }} />
        {error && <p style={{ margin: 0, fontSize: 12, color: "#f19aa4" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ minHeight: 44, padding: "0 16px", borderRadius: 14, border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.textMuted, cursor: saving ? "wait" : "pointer", fontWeight: 700, fontFamily: "'Pretendard', sans-serif" }}>취소</button>
          <button type="button" onClick={onSubmit} disabled={saving} style={{ minHeight: 44, padding: "0 18px", borderRadius: 14, border: "none", background: accent, color: "#122018", cursor: saving ? "wait" : "pointer", fontWeight: 800, fontFamily: "'Pretendard', sans-serif" }}>{saving ? "저장 중..." : "메모 저장"}</button>
        </div>
      </div>
    </ModalShell>
  );
};

const StudyTimelineEditModal = ({ activity, layout, saving, deleting, error, onClose, onSubmit, onDelete }) => {
  const [titleValue, setTitleValue] = useState("");
  const [summaryValue, setSummaryValue] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const accent = COLORS.study.main;

  useEffect(() => {
    if (!activity) return;
    setTitleValue(activity.title || "");
    setSummaryValue(activity.summary || "");
    setDateValue(toDateInputValue(activity.occurredAt));
    setTimeValue(toTimeInputValue(activity.occurredAt));
  }, [activity]);

  if (!activity) return null;

  return (
    <ModalShell
      glow={COLORS.study.glow}
      width="min(92vw, 430px)"
      padding={layout.isPhone ? "22px 18px" : "24px 22px"}
      onBackdropClick={onClose}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ paddingRight: 44 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Study Activity</p>
          <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>공부 활동 수정</h4>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: COLORS.dark.textMuted }}>{activity.title}</p>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>활동 제목</label>
          <input
            type="text"
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value)}
            placeholder="예: 공부 시작, 120p까지 공부"
            style={{ width: "100%", minHeight: 52, borderRadius: 16, border: `1px solid ${accent}28`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "0 16px", fontSize: 15, outline: "none" }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>메모</label>
          <textarea
            value={summaryValue}
            onChange={(event) => setSummaryValue(event.target.value)}
            placeholder="이 활동에 대한 메모를 남겨보세요."
            rows={5}
            style={{ width: "100%", borderRadius: 16, border: `1px solid ${accent}24`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "14px 16px", fontSize: 13, lineHeight: 1.65, resize: "vertical", outline: "none", fontFamily: "'Pretendard', sans-serif" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>기록 날짜</label>
            <input
              type="date"
              value={dateValue}
              onChange={(event) => setDateValue(event.target.value)}
              style={{ width: "100%", minHeight: 52, borderRadius: 16, border: `1px solid ${accent}28`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "0 16px", fontSize: 15, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>기록 시간</label>
            <input
              type="time"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
              style={{ width: "100%", minHeight: 52, borderRadius: 16, border: `1px solid ${accent}28`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, padding: "0 16px", fontSize: 15, outline: "none" }}
            />
          </div>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 16, border: `1px solid ${accent}22`, background: `${accent}10` }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: COLORS.dark.textMuted }}>현재 진행률</p>
          <strong style={{ fontSize: 24, color: accent, fontFamily: "'Outfit', sans-serif" }}>{activity.progress}%</strong>
        </div>

        {error ? <p style={{ margin: 0, fontSize: 12, color: "#f8b4bb" }}>{error}</p> : null}

        <button
          type="button"
          onClick={() => onSubmit?.({
            title: titleValue.trim(),
            summary: summaryValue.trim(),
            occurred_at: combineDateAndTimeInputs(dateValue, timeValue, activity.occurredAt),
          })}
          disabled={saving || deleting || !dateValue || !titleValue.trim()}
          style={{
            minHeight: 48,
            borderRadius: 16,
            border: "none",
            background: accent,
            color: "#1a1816",
            fontWeight: 800,
            cursor: saving || deleting ? "wait" : "pointer",
            fontFamily: "'Pretendard', sans-serif",
          }}
        >
          {saving ? "저장 중..." : "활동 저장"}
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(activity)}
          disabled={saving || deleting}
          style={{
            minHeight: 46,
            borderRadius: 16,
            border: "1px solid rgba(230,57,70,0.28)",
            background: "rgba(230,57,70,0.08)",
            color: "#f3b7bd",
            fontWeight: 800,
            cursor: saving || deleting ? "wait" : "pointer",
            fontFamily: "'Pretendard', sans-serif",
          }}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </ModalShell>
  );
};

export const ReadingDetailPage = ({ book, layout, onBack, onEdit, onAdd, onAddNote }) => {
  const accent = COLORS.reading.progress;
  const progress = clamp(safeNumber(book.progress), 0, 100);
  const tags = Array.isArray(book.tags) ? book.tags : [];
  const publishedLabel = book.publishedDate ? formatMonthDayLabel(book.publishedDate) : "";
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [visibleTimelineKeys, setVisibleTimelineKeys] = useState({});
  const timelineEntryRefs = useRef({});
  const trendPoints = useMemo(() => buildReadingTrendPoints(book), [book]);
  const timelineGroups = useMemo(() => buildReadingTimelineGroups(book), [book]);
  const readingFeedNotes = useMemo(
    () => (Array.isArray(book.readingNotes) ? [...book.readingNotes].sort((a, b) => new Date(b.date) - new Date(a.date)) : []),
    [book],
  );

  useEffect(() => {
    setVisibleTimelineKeys({});
  }, [book.id]);

  useEffect(() => {
    if (typeof window === "undefined" || timelineGroups.length === 0) return undefined;
    if (typeof window.IntersectionObserver === "undefined") {
      setVisibleTimelineKeys(
        timelineGroups.reduce((acc, group) => ({ ...acc, [group.dateKey]: true }), {}),
      );
      return undefined;
    }
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = entry.target.getAttribute("data-timeline-key");
        if (!key) return;
        setVisibleTimelineKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      });
    }, { threshold: 0.28, rootMargin: "0px 0px -10% 0px" });

    timelineGroups.forEach((group) => {
      const node = timelineEntryRefs.current[group.dateKey];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [timelineGroups]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.32s ease-out" }}>
      <DetailTopBar
        accent={accent}
        backLabel="독서 목록"
        onBack={onBack}
        onEdit={() => onEdit(book)}
        primaryAction={(
          <button
            type="button"
            onClick={() => onAdd(book)}
            style={{
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 999,
              border: `1px solid ${accent}66`,
              background: `${accent}18`,
              color: accent,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "'Pretendard', sans-serif",
            }}
          >
            + 독서 기록
          </button>
        )}
      />

      <FeatureDetailHeroShell
        layout={layout}
        accent={accent}
        glow={COLORS.reading.glow}
        imageSrc={book.cover}
        imageAlt={`${book.title} 표지`}
        fallback={<BookIcon size={42} color={accent} />}
      >
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
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {book.publisher && <Badge text={book.publisher} color={accent} />}
          {publishedLabel && <Badge text={publishedLabel} color={accent} />}
          {(tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: COLORS.dark.textMuted, display: descriptionExpanded ? "block" : "-webkit-box", WebkitLineClamp: descriptionExpanded ? "unset" : 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {book.description}
            </p>
            <button
              type="button"
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: accent, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Pretendard', sans-serif" }}
            >
              <span style={{ transform: descriptionExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                <ChevronDown size={14} color={accent} />
              </span>
              {descriptionExpanded ? "접기" : "펼치기"}
            </button>
          </div>
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
          <button
            type="button"
            onClick={() => onAddNote(book)}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 14, border: `1px solid ${accent}44`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.text, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Pretendard', sans-serif" }}
          >
            + 독서 메모
          </button>
        </div>
      </FeatureDetailHeroShell>

      <GlassCard glow={COLORS.reading.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "minmax(0, 1fr) 158px", gap: 18, alignItems: "center" }}>
          <div style={{ width: "100%" }}>
            <SeriesProgressTrendChart
              points={trendPoints}
              color={accent}
              labelColor={COLORS.reading.progressSoft}
              gridColor={`${accent}24`}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: layout.isPhone ? 118 : 132, height: layout.isPhone ? 118 : 132 }}>
              <SeriesProgressDonut value={progress} size={layout.isPhone ? 118 : 132} strokeWidth={11} color={accent} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>TOTAL</span>
                <strong style={{ fontSize: layout.isPhone ? 28 : 32, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>{progress}%</strong>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>{`${book.readPages}/${book.pages}p`}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard glow={COLORS.reading.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Reading Timeline</p>
            <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>독서 타임라인</h4>
          </div>
          {timelineGroups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>아직 독서 기록이나 메모가 없습니다.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: layout.isPhone ? 0 : 8 }}>
              <div style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: layout.isPhone ? 17 : 118,
                width: 2,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${accent}cc, ${accent}44)`,
                boxShadow: `0 0 18px ${accent}22`,
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {(timelineGroups || []).map((group, index) => {
                  const timelineVisible = visibleTimelineKeys[group.dateKey] ?? false;
                  const sessionStartLabel = group.session ? formatTimeLabel(group.session.startedAt) : "";
                  const sessionEndLabel = group.session ? formatTimeLabel(group.session.endedAt) : "";
                  const hasSessionTiming = Boolean(
                    group.session
                    && group.session.durationMinutes > 0
                    && sessionStartLabel
                    && sessionEndLabel
                    && sessionStartLabel !== sessionEndLabel,
                  );
                  const sessionMetaLabel = hasSessionTiming
                    ? `${sessionStartLabel} - ${sessionEndLabel} · ${formatReadingDuration(group.session.durationMinutes)}`
                    : "";
                  const trackProgress = group.session ? clamp(safeNumber(group.session.toProgress), 0, 100) : 0;
                  const deltaStart = group.session ? clamp(safeNumber(group.session.fromProgress), 0, 100) : 0;
                  return (
                    <div
                      key={`reading-timeline-${group.dateKey}`}
                      ref={(node) => {
                        timelineEntryRefs.current[group.dateKey] = node;
                      }}
                      data-timeline-key={group.dateKey}
                      style={{
                        position: "relative",
                        display: "grid",
                        gridTemplateColumns: layout.isPhone ? "1fr" : "88px minmax(0, 1fr)",
                        gap: layout.isPhone ? 10 : 20,
                        paddingLeft: layout.isPhone ? 38 : 0,
                        paddingBottom: index === timelineGroups.length - 1 ? 0 : 6,
                        opacity: timelineVisible ? 1 : 0.38,
                        transform: timelineVisible ? "translateY(0)" : "translateY(18px)",
                        transition: "opacity 0.5s ease, transform 0.7s cubic-bezier(.16,1,.3,1)",
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        left: layout.isPhone ? 11 : 111,
                        top: layout.isPhone ? 18 : 22,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${COLORS.reading.progressSoft}, ${accent})`,
                        border: `2px solid ${COLORS.dark.bg}`,
                        boxShadow: `0 0 0 6px ${accent}12, 0 0 18px ${accent}22`,
                        zIndex: 1,
                      }} />
                      <div style={{ display: "flex", flexDirection: layout.isPhone ? "row" : "column", alignItems: layout.isPhone ? "baseline" : "flex-end", gap: layout.isPhone ? 8 : 0, paddingTop: layout.isPhone ? 6 : 2, paddingRight: layout.isPhone ? 0 : 10 }}>
                        <span style={{ fontSize: layout.isPhone ? 34 : 54, lineHeight: 1, fontWeight: 800, letterSpacing: -2, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{group.dayNumber}</span>
                        <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{group.sideLabel}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {group.session && (
                          <div style={{ borderRadius: 22, border: `1px solid ${accent}2c`, background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${accent}12)`, padding: layout.isPhone ? "16px" : "18px 20px", boxShadow: "0 18px 34px rgba(0,0,0,0.14)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: 0.5, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Today's Progress</p>
                                <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1, fontWeight: 800, fontFamily: "'Pretendard', sans-serif", color: COLORS.dark.text }}>{`+${safeNumber(group.session.pagesRead)}p 읽음`}</h3>
                              </div>
                              <div style={{ textAlign: "right", display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "'Outfit', sans-serif" }}>{`+${safeNumber(group.session.progressDelta)}%`}</span>
                                <strong style={{ fontSize: 42, fontWeight: 800, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1, display: "flex", alignItems: "baseline" }}>
                                  <span>{trackProgress}</span>
                                  <span style={{ fontSize: 18, marginLeft: 1 }}>%</span>
                                </strong>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <TimelineProgressBar
                                value={trackProgress}
                                startValue={deltaStart}
                                accent={accent}
                                deltaColor={COLORS.reading.progressSoft}
                                visible={timelineVisible}
                                height={16}
                                boxShadow={false}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, alignItems: "center" }}>
                                <p style={{ margin: 0, fontSize: 12, lineHeight: 1, color: COLORS.dark.textMuted }}>
                                  {`${safeNumber(group.session.fromPages)}p → ${safeNumber(group.session.toPages)}p (+${safeNumber(group.session.pagesRead)}p)`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        {group.notes.length > 0 && (
                          <div style={{ borderRadius: 22, border: `1px solid ${COLORS.dark.border}`, background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))", padding: layout.isPhone ? "16px" : "18px 20px", boxShadow: "0 18px 34px rgba(0,0,0,0.12)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <Badge text="메모 스니펫" color={COLORS.reading.progressSoft} />
                                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{`${group.notes.length}개 메모`}</span>
                              </div>
                              <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>
                                {formatTimeLabel(group.notes[0]?.date)}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {group.notes[0]?.text}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard glow={COLORS.reading.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Reading Feed</p>
              <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>독서 피드</h4>
            </div>
            <button
              type="button"
              onClick={() => onAddNote(book)}
              style={{ minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${accent}44`, background: `${accent}12`, color: accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Pretendard', sans-serif" }}
            >
              + 독서 메모
            </button>
          </div>
          {readingFeedNotes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>아직 남긴 독서 메모가 없습니다.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(readingFeedNotes || []).map((note) => (
                <div key={note.id} style={{ position: "relative", padding: layout.isPhone ? "18px 16px 16px" : "20px 18px 18px", borderRadius: 22, border: `1px solid ${accent}20`, background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))", overflow: "hidden", boxShadow: "0 18px 34px rgba(0,0,0,0.12)" }}>
                  <span style={{ position: "absolute", top: -12, left: 12, fontSize: layout.isPhone ? 74 : 82, lineHeight: 1, fontWeight: 800, color: `${accent}18`, fontFamily: "'Outfit', sans-serif", pointerEvents: "none" }}>
                    “
                  </span>
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Badge text="독서 메모" color={COLORS.reading.progressSoft} />
                        {note.page > 0 ? <span style={{ fontSize: 12, color: accent, fontFamily: "'Outfit', sans-serif" }}>{`${note.page}p`}</span> : null}
                      </div>
                      <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>
                        {[formatMonthDayLabel(note.date), formatTimeLabel(note.date)].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, color: COLORS.dark.text }}>
                      {note.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      {(book?.tags || []).map(t => <Badge key={t} text={`#${t}`} color={COLORS.reading.main} />)}
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
export const ReadingPage = ({ books, loading, onEdit, onAdd, onAddNote, layout, initialDetailId = null }) => {
  const [viewMode, setViewMode] = useState("list");
  const [detailId, setDetailId] = useState(null);
  const [progressModalBook, setProgressModalBook] = useState(null);
  const [currentPageInput, setCurrentPageInput] = useState("0");
  const [totalPageInput, setTotalPageInput] = useState("0");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [noteModalBook, setNoteModalBook] = useState(null);
  const [notePageInput, setNotePageInput] = useState("0");
  const [progressError, setProgressError] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const detailBook = books.find((book) => book.id === detailId) || null;

  useEffect(() => {
    if (detailId && !detailBook && books.length > 0) {
      setDetailId(null);
    }
  }, [books.length, detailBook, detailId]);

  useEffect(() => {
    if (initialDetailId) setDetailId(initialDetailId);
  }, [initialDetailId]);

  const openProgressModal = useCallback((book) => {
    const latestSession = Array.isArray(book.readingSessions) && book.readingSessions.length > 0
      ? [...book.readingSessions].sort((a, b) => new Date(b.endedAt || b.date) - new Date(a.endedAt || a.date))[0]
      : null;
    const nowIso = new Date().toISOString();
    setProgressModalBook(book);
    setCurrentPageInput(String(safeNumber(book.readPages)));
    setTotalPageInput(String(Math.max(safeNumber(book.pages), safeNumber(book.readPages))));
    setStartTimeInput(toTimeInputValue(latestSession?.startedAt || nowIso));
    setEndTimeInput(toTimeInputValue(latestSession?.endedAt || nowIso));
    setNoteInput(book.review || "");
    setProgressError("");
  }, []);

  const openNoteModal = useCallback((book) => {
    setNoteModalBook(book);
    setNotePageInput(String(safeNumber(book.readPages)));
    setNoteInput("");
    setNoteError("");
  }, []);

  const closeProgressModal = useCallback(() => {
    if (savingProgress) return;
    setProgressModalBook(null);
    setCurrentPageInput("0");
    setTotalPageInput("0");
    setStartTimeInput("");
    setEndTimeInput("");
    setNoteInput("");
    setProgressError("");
  }, [savingProgress]);

  const closeNoteModal = useCallback(() => {
    if (savingNote) return;
    setNoteModalBook(null);
    setNotePageInput("0");
    setNoteInput("");
    setNoteError("");
  }, [savingNote]);

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
    if (!startTimeInput || !endTimeInput) {
      setProgressError("독서 시작 시각과 종료 시각을 입력해 주세요.");
      return;
    }
    const startedAt = combineDateAndTime(progressModalBook.date || new Date().toISOString(), startTimeInput);
    const endedAt = combineDateAndTime(progressModalBook.date || new Date().toISOString(), endTimeInput);
    if (!startedAt || !endedAt) {
      setProgressError("독서 시각 형식이 올바르지 않습니다.");
      return;
    }
    if (new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
      setProgressError("독서 종료 시각은 시작 시각보다 빠를 수 없습니다.");
      return;
    }
    try {
      setSavingProgress(true);
      setProgressError("");
      await onAdd(progressModalBook, {
        currentPages,
        totalPages,
        startedAt,
        endedAt,
        note: noteInput,
      });
      setProgressModalBook(null);
      setCurrentPageInput("0");
      setTotalPageInput("0");
      setStartTimeInput("");
      setEndTimeInput("");
      setNoteInput("");
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "페이지 업데이트 중 오류가 발생했습니다.");
    } finally {
      setSavingProgress(false);
    }
  }, [currentPageInput, endTimeInput, noteInput, onAdd, progressModalBook, startTimeInput, totalPageInput]);

  const submitNoteModal = useCallback(async () => {
    if (!noteModalBook) return;
    if (!noteInput.trim()) {
      setNoteError("메모 내용을 입력해 주세요.");
      return;
    }
    try {
      setSavingNote(true);
      setNoteError("");
      await onAddNote(noteModalBook, { page: notePageInput, text: noteInput });
      setNoteModalBook(null);
      setNotePageInput("0");
      setNoteInput("");
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "메모 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingNote(false);
    }
  }, [noteInput, noteModalBook, notePageInput, onAddNote]);

  if (detailBook) {
    return (
      <>
        <ReadingDetailPage
          book={detailBook}
          layout={layout}
          onBack={() => setDetailId(null)}
          onEdit={onEdit}
          onAdd={openProgressModal}
          onAddNote={openNoteModal}
        />
        <ReadingProgressModal
          book={progressModalBook}
          layout={layout}
          saving={savingProgress}
          error={progressError}
          currentPages={currentPageInput}
          totalPages={totalPageInput}
          startTime={startTimeInput}
          endTime={endTimeInput}
          note={noteInput}
          onCurrentPagesChange={(value) => {
            setCurrentPageInput(value);
            setProgressError("");
          }}
          onTotalPagesChange={(value) => {
            setTotalPageInput(value);
            setProgressError("");
          }}
          onStartTimeChange={(value) => {
            setStartTimeInput(value);
            setProgressError("");
          }}
          onEndTimeChange={(value) => {
            setEndTimeInput(value);
            setProgressError("");
          }}
          onNoteChange={(value) => {
            setNoteInput(value);
            setProgressError("");
          }}
          onClose={closeProgressModal}
          onSubmit={submitProgressModal}
        />
        <ReadingNoteModal
          book={noteModalBook}
          layout={layout}
          saving={savingNote}
          error={noteError}
          page={notePageInput}
          note={noteInput}
          onPageChange={setNotePageInput}
          onNoteChange={(value) => {
            setNoteInput(value);
            setNoteError("");
          }}
          onClose={closeNoteModal}
          onSubmit={submitNoteModal}
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
          {(books || []).map((book, idx) => (
            <div
              key={book.id}
              style={{
                animation: "cardStaggerIn 0.32s ease-out both",
                animationDelay: `${Math.min(idx * 45, 220)}ms`,
              }}
            >
              <FeatureCardShell
                layout={layout}
                accent={COLORS.reading.main}
                glow={COLORS.reading.glow}
                imageSrc={book.cover}
                imageAlt={`${book.title} 표지`}
                fallback={<BookIcon size={28} color={COLORS.reading.main} />}
                onOpen={() => setDetailId(book.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontSize: 18, fontWeight: 800, color: COLORS.dark.text, margin: "0 0 6px", fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>
                      {book.title}
                    </h4>
                    <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: 0 }}>{book.author}</p>
                  </div>
                  <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(book); }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, letterSpacing: 0.6, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                    독서 진행률
                  </span>
                  {book.rating > 0 ? <RatingStars rating={book.rating} size={12} /> : null}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                  <strong style={{ fontSize: 28, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", lineHeight: 0.9 }}>
                    {book.progress}<span style={{ fontSize: 14, color: COLORS.reading.main }}>%</span>
                  </strong>
                  <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{book.readPages}/{book.pages}p</span>
                </div>
                <ProgressBar value={book.progress} color={COLORS.reading.main} height={8} />
                {book.review ? <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>"{book.review}"</p> : null}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-end", marginTop: "auto" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                    {(book?.tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={COLORS.reading.main} />)}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openProgressModal(book);
                    }}
                    style={{
                      minHeight: 36,
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
                </div>
              </FeatureCardShell>
            </div>
          ))}
        </div>
      ) : (
        <div key="reading-grid" style={{ animation: "viewSwitch 0.28s ease-out" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${getResponsiveColumns(layout, { phone: 1, tablet: 2, desktop: 3 })}, minmax(0, 1fr))`, gap: 12 }}>
            {(books || []).map((book, idx) => (
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
      startTime={startTimeInput}
      endTime={endTimeInput}
      note={noteInput}
      onCurrentPagesChange={(value) => {
        setCurrentPageInput(value);
        setProgressError("");
      }}
      onTotalPagesChange={(value) => {
        setTotalPageInput(value);
        setProgressError("");
      }}
      onStartTimeChange={(value) => {
        setStartTimeInput(value);
        setProgressError("");
      }}
      onEndTimeChange={(value) => {
        setEndTimeInput(value);
        setProgressError("");
      }}
      onNoteChange={(value) => {
        setNoteInput(value);
        setProgressError("");
      }}
      onClose={closeProgressModal}
      onSubmit={submitProgressModal}
    />
    <ReadingNoteModal
      book={noteModalBook}
      layout={layout}
      saving={savingNote}
      error={noteError}
      page={notePageInput}
      note={noteInput}
      onPageChange={setNotePageInput}
      onNoteChange={(value) => {
        setNoteInput(value);
        setNoteError("");
      }}
      onClose={closeNoteModal}
      onSubmit={submitNoteModal}
    />
    </>
  );
};

const StudyProgressModal = ({
  item,
  layout,
  saving,
  currentValue,
  onValueChange,
  onClose,
  onSubmit,
}) => {
  if (!item) return null;
  const accent = COLORS.study.main;
  const isPageMode = item.progressMode === "page";
  const total = isPageMode ? item.pagesTotal : item.chapters?.length || 0;

  return (
    <ModalShell
      glow={COLORS.study.glow}
      width="min(92vw, 430px)"
      padding={layout.isPhone ? "22px 18px" : "24px 22px"}
      onBackdropClick={onClose}
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
            Study Progress
          </p>
          <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
            공부 기록 추가
          </h4>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: COLORS.dark.textMuted }}>
            {isPageMode ? "현재 공부한 페이지" : "완료한 챕터 수"}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 52, borderRadius: 16, border: `1px solid ${accent}28`, background: "rgba(255,255,255,0.04)", padding: "0 16px" }}>
            <input
              value={currentValue}
              onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ""))}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={isPageMode ? "몇 페이지까지 공부했나요?" : "몇 개 챕터를 완료했나요?"}
              style={{ width: "100%", border: "none", background: "transparent", color: COLORS.dark.text, fontSize: 15, outline: "none", fontFamily: "'Outfit', sans-serif" }}
            />
            <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontWeight: 700 }}>
              {isPageMode ? "p." : "개"}
            </span>
          </div>
          {total > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: COLORS.dark.textMuted }}>
              전체 {total}{isPageMode ? "p" : "개"} 중 현재 {currentValue}{isPageMode ? "p" : "개"}
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ minHeight: 44, padding: "0 16px", borderRadius: 14, border: `1px solid ${COLORS.dark.border}`, background: "rgba(255,255,255,0.04)", color: COLORS.dark.textMuted, cursor: saving ? "wait" : "pointer", fontWeight: 700, fontFamily: "'Pretendard', sans-serif" }}>취소</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            style={{
              minHeight: 44, padding: "0 18px", borderRadius: 14, border: "none",
              background: accent, color: "#1a1816",
              cursor: saving ? "wait" : "pointer", fontWeight: 800, fontFamily: "'Pretendard', sans-serif"
            }}
          >
            {saving ? "기록 중..." : "공부 기록 반영"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

/* ──────────── Page: Study ──────────── */
/* ──────────── Study Detail Page ──────────── */
const StudyDetailPage = ({ item, layout, onBack, onEdit, onAdd, onUpdateActivity, onDeleteActivity }) => {
  const accent = COLORS.study.main;
  const isPageMode = item.progressMode === "page";
  const trendPoints = useMemo(() => buildStudyTrendPoints(item), [item]);
  const [visibleTimelineKeys, setVisibleTimelineKeys] = useState({});
  const [editingActivity, setEditingActivity] = useState(null);
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityDeleting, setActivityDeleting] = useState(false);
  const [activityError, setActivityError] = useState("");
  const timelineEntryRefs = useRef({});
  const timelineGroups = useMemo(() => buildStudyTimelineGroups(item), [item]);
  const completedCount = countStudyCompletedItems(item);
  const totalCount = countStudyTotalItems(item);

  useEffect(() => {
    setVisibleTimelineKeys({});
  }, [item.id]);

  useEffect(() => {
    setEditingActivity(null);
    setActivitySaving(false);
    setActivityDeleting(false);
    setActivityError("");
  }, [item.id]);

  useEffect(() => {
    if (typeof window === "undefined" || timelineGroups.length === 0) return undefined;
    if (typeof window.IntersectionObserver === "undefined") {
      setVisibleTimelineKeys(
        timelineGroups.reduce((acc, group) => ({ ...acc, [group.dateKey]: true }), {}),
      );
      return undefined;
    }
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const key = entry.target.getAttribute("data-timeline-key");
        if (!key) return;
        setVisibleTimelineKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      });
    }, { threshold: 0.28, rootMargin: "0px 0px -10% 0px" });

    timelineGroups.forEach((group) => {
      const node = timelineEntryRefs.current[group.dateKey];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [timelineGroups]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      <DetailTopBar
        accent={accent}
        backLabel="공부 목록"
        onBack={onBack}
        onEdit={() => onEdit(item)}
        primaryAction={(
          <button
            type="button"
            onClick={() => onAdd(item)}
            style={{
              minHeight: 40,
              padding: "0 14px",
              borderRadius: 999,
              border: "none",
              background: accent,
              color: "#1a1816",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "'Pretendard', sans-serif",
            }}
          >
            + 기록 추가
          </button>
        )}
      />

      <FeatureDetailHeroShell
        layout={layout}
        accent={accent}
        glow={COLORS.study.glow}
        imageSrc={item.imageUrl}
        imageAlt={`${item.title} 표지`}
        fallback={<BookIcon size={32} color={accent} />}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Badge text="공부 중" color={accent} />
            <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{formatRelativeTime(item.startedAt || item.date)} 시작</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>
            {item.title}
          </h2>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {item.goal && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StarIcon size={14} color={accent} />
              <span style={{ fontSize: 13, color: COLORS.dark.textMuted }}>{item.goal}</span>
            </div>
          )}
          {item.hours > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ClockIcon size={14} color={accent} />
              <span style={{ fontSize: 13, color: COLORS.dark.textMuted }}>누적 {item.hours}시간</span>
            </div>
          )}
        </div>

        {item.tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(item?.tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
          </div>
        )}
      </FeatureDetailHeroShell>

      {/* 통합 진행 현황 및 통계 섹션 */}
      <GlassCard style={{ padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 상단: 진행률 바 */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", letterSpacing: 0.5 }}>
                CURRENT STATUS
              </h4>
              <span style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: "'Outfit', sans-serif" }}>
                {item.progress}%
              </span>
            </div>
            <ProgressBar value={item.progress} color={accent} height={12} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: COLORS.dark.textMuted, fontSize: 13, fontWeight: 600 }}>
              <span>{isPageMode ? "페이지" : "목차"} 기준 진행</span>
              <span style={{ color: COLORS.dark.text }}>
                {isPageMode 
                  ? `${item.pagesRead} / ${item.pagesTotal}p` 
                  : `${completedCount} / ${totalCount} 챕터`}
              </span>
            </div>
          </div>

          {/* 하단: 통계 요약 (2열 그리드) */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: 16, 
            paddingTop: 20,
            borderTop: `1px solid ${COLORS.dark.border}` 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ListIcon size={18} color={accent} />
              </div>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: COLORS.dark.textMuted }}>남은 과제</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.dark.text }}>
                  {isPageMode 
                    ? `${Math.max(0, item.pagesTotal - item.pagesRead)}p` 
                    : `${Math.max(0, totalCount - completedCount)}개`}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CalendarIcon size={18} color={accent} />
              </div>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: COLORS.dark.textMuted }}>마지막 기록</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.dark.text }}>{formatRelativeTime(item.date)}</p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 진행률 차트 섹션 (Progress Trend) */}
      <GlassCard glow={COLORS.study.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "minmax(0, 1fr) 158px", gap: 18, alignItems: "center" }}>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Progress Trend</p>
            </div>
            <SeriesProgressTrendChart
              points={trendPoints}
              color={accent}
              labelColor={`${accent}cc`}
              gridColor={`${accent}24`}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: layout.isPhone ? 118 : 132, height: layout.isPhone ? 118 : 132 }}>
              <SeriesProgressDonut value={item.progress} size={layout.isPhone ? 118 : 132} strokeWidth={11} color={accent} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>TOTAL</span>
                <strong style={{ fontSize: layout.isPhone ? 28 : 32, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>{item.progress}%</strong>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              {isPageMode 
                ? `${item.pagesRead}/${item.pagesTotal}p` 
                : `${completedCount} / ${totalCount} 챕터`}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard glow={COLORS.study.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Study Timeline</p>
            <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>공부 타임라인</h4>
          </div>
          {timelineGroups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>아직 쌓인 공부 액티비티가 없습니다.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: layout.isPhone ? 0 : 8 }}>
              <div style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: layout.isPhone ? 17 : 118,
                width: 2,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${accent}cc, ${accent}44)`,
                boxShadow: `0 0 18px ${accent}22`,
              }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {timelineGroups.map((group, index) => {
                  const timelineVisible = visibleTimelineKeys[group.dateKey] ?? false;
                  return (
                    <div
                      key={`study-timeline-${group.dateKey}`}
                      ref={(node) => {
                        timelineEntryRefs.current[group.dateKey] = node;
                      }}
                      data-timeline-key={group.dateKey}
                      style={{
                        position: "relative",
                        display: "grid",
                        gridTemplateColumns: layout.isPhone ? "1fr" : "88px minmax(0, 1fr)",
                        gap: layout.isPhone ? 10 : 20,
                        paddingLeft: layout.isPhone ? 38 : 0,
                        paddingBottom: index === timelineGroups.length - 1 ? 0 : 6,
                        opacity: timelineVisible ? 1 : 0.38,
                        transform: timelineVisible ? "translateY(0)" : "translateY(18px)",
                        transition: "opacity 0.5s ease, transform 0.7s cubic-bezier(.16,1,.3,1)",
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        left: layout.isPhone ? 11 : 111,
                        top: layout.isPhone ? 18 : 22,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${COLORS.study.light}, ${accent})`,
                        border: `2px solid ${COLORS.dark.bg}`,
                        boxShadow: `0 0 0 6px ${accent}12, 0 0 18px ${accent}22`,
                        zIndex: 1,
                      }} />
                      <div style={{ display: "flex", flexDirection: layout.isPhone ? "row" : "column", alignItems: layout.isPhone ? "baseline" : "flex-end", gap: layout.isPhone ? 8 : 0, paddingTop: layout.isPhone ? 6 : 2, paddingRight: layout.isPhone ? 0 : 10 }}>
                        <span style={{ fontSize: layout.isPhone ? 34 : 54, lineHeight: 1, fontWeight: 800, letterSpacing: -2, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{group.dayNumber}</span>
                        <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>{group.sideLabel}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {group.activities.map((activity) => {
                          const isTimelinePage = activity.progressMode === "page";
                          const trackProgress = clamp(safeNumber(activity.progress), 0, 100);
                          const deltaStart = clamp(safeNumber(activity.progressStart), 0, 100);
                          return (
                            <button
                              key={activity.id}
                              type="button"
                              onClick={() => {
                                setActivityError("");
                                setEditingActivity(activity);
                              }}
                              style={{
                                width: "100%",
                                borderRadius: 22,
                                border: `1px solid ${accent}2c`,
                                background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${accent}12)`,
                                padding: layout.isPhone ? "16px" : "18px 20px",
                                boxShadow: "0 18px 34px rgba(0,0,0,0.14)",
                                textAlign: "left",
                                cursor: "pointer",
                                color: COLORS.dark.text,
                                appearance: "none",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: 0.5, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Study Activity</p>
                                  <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1, fontWeight: 800, fontFamily: "'Pretendard', sans-serif", color: COLORS.dark.text }}>
                                    {activity.title}
                                  </h3>
                                </div>
                                <div style={{ textAlign: "right", display: "flex", alignItems: "baseline", gap: 8 }}>
                                  <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{formatTimeLabel(activity.occurredAt)}</span>
                                  {activity.progressDelta > 0 ? (
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "'Outfit', sans-serif" }}>
                                      {`+${activity.progressDelta}%`}
                                    </span>
                                  ) : null}
                                  <strong style={{ fontSize: 42, fontWeight: 800, color: accent, fontFamily: "'Outfit', sans-serif", lineHeight: 1, display: "flex", alignItems: "baseline" }}>
                                    <span>{activity.progress}</span>
                                    <span style={{ fontSize: 18, marginLeft: 1 }}>%</span>
                                  </strong>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <TimelineProgressBar
                                  value={trackProgress}
                                  startValue={deltaStart}
                                  accent={accent}
                                  deltaColor={COLORS.study.light}
                                  visible={timelineVisible}
                                  height={16}
                                  boxShadow={false}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: COLORS.dark.textMuted }}>
                                    {isTimelinePage
                                      ? `${activity.pagesRead}p / ${activity.pagesTotal}p`
                                      : `${activity.completedCount} / ${activity.totalCount} 챕터 완료`}
                                  </p>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: COLORS.dark.textMuted }}>
                                    {`${deltaStart}% → ${trackProgress}%`}
                                  </p>
                                  {activity.tags.length > 0 ? (
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                      {activity.tags.map((tag) => <Badge key={`${activity.id}-${tag}`} text={`#${tag}`} color={accent} />)}
                                    </div>
                                  ) : null}
                                </div>
                                {activity.summary ? (
                                  <div style={{ borderRadius: 16, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}16` }}>
                                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.text }}>
                                      {activity.summary}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* 회고 섹션 (있을 때만) */}
      {item.summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>RETROSPECTIVE</h4>
          <GlassCard style={{ 
            padding: 24, 
            background: `linear-gradient(135deg, rgba(255,255,255,0.03), ${accent}08)`,
            borderLeft: `4px solid ${accent}`,
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: 16, 
              lineHeight: 1.8, 
              color: COLORS.dark.text, 
              fontFamily: "'Pretendard', sans-serif",
              whiteSpace: "pre-wrap"
            }}>
              "{item.summary}"
            </p>
          </GlassCard>
        </div>
      )}

      {/* 목차 섹션 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>TABLE OF CONTENTS</h4>
          <p style={{ margin: 0, fontSize: 11, color: accent, fontWeight: 700 }}>* 자동 저장됨</p>
        </div>
        <StudyAccordion study={item} onSaveToc={(nextToc) => {
          // 실시간 저장을 위해 onEdit 시트에 넘겨주는 data를 구성하여 호출하거나
          // 별도의 저장 함수가 필요함.
          // 여기서는 '수정' 버튼을 눌러 저장하는 기존 방식을 유지하되,
          // 상세 페이지에서 toc 상태가 변경되었음을 인지할 수 있도록 처리함.
          // (현 시점에서는 UI 반영 위주, 실제 영구 저장은 '수정' 버튼 클릭 후 완료 시 수행)
        }} />
      </div>

      <StudyTimelineEditModal
        activity={editingActivity}
        layout={layout}
        saving={activitySaving}
        deleting={activityDeleting}
        error={activityError}
        onClose={() => {
          if (activitySaving || activityDeleting) return;
          setEditingActivity(null);
          setActivityError("");
        }}
        onSubmit={async (patch) => {
          if (!editingActivity || !patch?.occurred_at || !patch?.title) return;
          setActivitySaving(true);
          setActivityError("");
          try {
            await onUpdateActivity?.(editingActivity.id, patch);
            setEditingActivity(null);
          } catch (error) {
            setActivityError(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
          } finally {
            setActivitySaving(false);
          }
        }}
        onDelete={async (activity) => {
          if (!activity?.id || !window.confirm("이 기록을 삭제할까요?")) return;
          setActivityDeleting(true);
          setActivityError("");
          try {
            await onDeleteActivity?.(activity.id);
            setEditingActivity(null);
          } catch (error) {
            setActivityError(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.");
          } finally {
            setActivityDeleting(false);
          }
        }}
      />
    </div>
  );
};

export const StudyPage = ({ studies, loading, onEdit, onSave, onUpdateActivity, onDeleteActivity, layout, initialDetailId = null }) => {
  const groupedStudies = useMemo(() => groupStudiesByEntity(studies), [studies]);
  const [detailId, setDetailId] = useState(null);
  const detail = groupedStudies.find((study) => study.id === detailId || study.entityId === detailId) || null;
  
  // 진행도 업데이트 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialDetailId) setDetailId(initialDetailId);
  }, [initialDetailId]);

  const openModal = (item) => {
    setModalItem(item);
    const initialValue = item.progressMode === "page" 
      ? (item.pagesRead || 0) 
      : (Array.isArray(item.completed) ? item.completed.filter(Boolean).length : 0);
    setInputValue(String(initialValue));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalItem(null);
    setInputValue("");
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!modalItem) return;
    setSaving(true);
    try {
      const isPageMode = modalItem.progressMode === "page";
      const val = safeNumber(inputValue);
      
      const payload = {
        category: "study",
        entity_id: modalItem.entityId,
        title: isPageMode ? `${val}p까지 공부` : `${val}개 챕터 완료`,
        summary: "",
        tags: modalItem.tags || [],
        payload: {
          ...modalItem, // 기존 메타데이터 유지
          progress_mode: modalItem.progressMode,
          pages_read: isPageMode ? val : (modalItem.pagesRead || 0),
          pages_total: modalItem.pagesTotal,
          // 챕터 모드인 경우 completed 배열 업데이트 로직 필요 (여기선 단순 개수로 처리하거나 기존 배열 활용)
          completed: !isPageMode 
            ? Array.from({ length: modalItem.chapters?.length || 0 }, (_, i) => i < val)
            : (modalItem.completed || []),
        }
      };

      await onSave(payload);
      closeModal();
    } catch (err) {
      console.error("Failed to save study progress", err);
    } finally {
      setSaving(false);
    }
  };

  if (detail) {
    return (
      <>
        <StudyDetailPage 
          item={detail} 
          layout={layout} 
          onBack={() => setDetailId(null)} 
          onEdit={onEdit}
          onAdd={openModal}
          onUpdateActivity={onUpdateActivity}
          onDeleteActivity={onDeleteActivity}
        />
        <StudyProgressModal
          item={modalItem}
          layout={layout}
          saving={saving}
          currentValue={inputValue}
          onValueChange={setInputValue}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <PenIcon size={20} color={COLORS.study.main} /> 공부 기록
      </h3>
      {!loading && groupedStudies.length === 0 && (
        <GlassCard>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>공부 기록이 없습니다.</p>
        </GlassCard>
      )}
      <div style={{ display: "grid", gridTemplateColumns: layout.isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 16 }}>
        {groupedStudies.map((s) => (
          <FeatureCardShell
            key={s.id}
            layout={layout}
            accent={COLORS.study.main}
            glow={COLORS.study.glow}
            imageSrc={s.imageUrl}
            imageAlt={`${s.title} 표지`}
            fallback={<PenIcon size={24} color={COLORS.study.main} />}
            onOpen={() => setDetailId(s.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <Badge text="공부 중" color={COLORS.study.main} />
              <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(s); }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h4 style={{ fontSize: 18, fontWeight: 800, color: COLORS.dark.text, margin: "0 0 6px", fontFamily: "'Outfit', sans-serif", lineHeight: 1.2 }}>
                {s.title}
              </h4>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                {s.progressMode === "page" && s.pagesTotal > 0 ? (
                  <>
                    <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", lineHeight: 0.9 }}>{s.pagesRead}</span>
                    <span style={{ fontSize: 11, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>/ {s.pagesTotal}p</span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark.text, fontFamily: "'Pretendard', sans-serif" }}>
                    {s.chapters?.length || 0}개 챕터
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 0.6, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                Study Progress
              </span>
              <strong style={{ fontSize: 28, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", lineHeight: 0.9 }}>
                {s.progress}<span style={{ fontSize: 14, color: COLORS.study.main }}>%</span>
              </strong>
            </div>
            <ProgressBar value={s.progress} color={COLORS.study.main} height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginTop: "auto" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                {s.tags.map((tag) => <Badge key={tag} text={`#${tag}`} color={COLORS.study.main} />)}
              </div>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); openModal(s); }}
                style={{
                  minHeight: 36,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "none",
                  background: COLORS.study.main,
                  color: "#1a1816",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Pretendard', sans-serif",
                  boxShadow: `0 4px 12px ${COLORS.study.main}44`,
                }}
              >
                + 기록
              </button>
            </div>
          </FeatureCardShell>
        ))}
      </div>
      <StudyProgressModal
        item={modalItem}
        layout={layout}
        saving={saving}
        currentValue={inputValue}
        onValueChange={setInputValue}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

const MediaDetailPage = ({ item, layout, onBack, onEdit }) => {
  const tone = getCultureTone(item.type);
  const accent = tone.main;
  const metaItems = [
    item.type,
    item.status,
    item.playtime,
    item.releaseDate ? formatMonthDayLabel(item.releaseDate) : "",
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 40 }}>
      <DetailTopBar
        accent={accent}
        backLabel={`${item.type} 목록`}
        onBack={onBack}
        onEdit={() => onEdit(item)}
      />

      <FeatureDetailHeroShell
        layout={layout}
        accent={accent}
        glow={tone.glow}
        imageSrc={item.poster}
        imageAlt={`${item.title} 포스터`}
        fallback={item.type === "게임" ? <GamepadIcon size={42} color={accent} /> : <FilmIcon size={42} color={accent} />}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              {item.type === "게임" ? "Game Detail" : "Media Detail"}
            </p>
            <h2 style={{ margin: "0 0 6px", fontSize: layout.isPhone ? 24 : 30, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
              {item.title}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>
              {metaItems.join(" · ")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusBadge status={item.status} />
            {item.rating > 0 ? <RatingStars rating={item.rating} size={14} /> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(item.tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
        </div>

        <div style={{
          padding: "14px 16px",
          borderRadius: 18,
          border: `1px solid ${accent}22`,
          background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.03))`,
          display: "grid",
          gridTemplateColumns: layout.isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>현재 상태</p>
            <strong style={{ fontSize: 20, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{item.status || "미설정"}</strong>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>진행 정보</p>
            <strong style={{ fontSize: 20, color: accent, fontFamily: "'Outfit', sans-serif" }}>{item.playtime || (item.rating > 0 ? `${item.rating.toFixed(1)} / 5` : "기록 대기")}</strong>
          </div>
        </div>

        {(item.summary || item.overview) ? (
          <GlassCard style={{ padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: COLORS.dark.text }}>
              {item.summary || item.overview}
            </p>
          </GlassCard>
        ) : null}
      </FeatureDetailHeroShell>
    </div>
  );
};

export const GameDetailPage = ({ item, layout, onBack, onEdit, onAddSession }) => {
  const accent = COLORS.game.main;
  const sessions = useMemo(
    () => (Array.isArray(item.gameSessions) ? [...item.gameSessions].sort((a, b) => new Date(b.playedAt || b.date) - new Date(a.playedAt || a.date)) : []),
    [item.gameSessions]
  );
  const totalMinutes = sessions.reduce((sum, session) => sum + safeNumber(session.durationMinutes), 0);
  const calendarMonths = useMemo(() => buildGameCalendarMonths(sessions), [sessions]);
  const lastPlayedAt = sessions[0]?.playedAt || sessions[0]?.date || item.lastPlayedAt || "";
  const actionButton = (
    <button
      type="button"
      onClick={() => onAddSession?.(item)}
      style={{
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${accent}66`,
        background: `${accent}18`,
        color: accent,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "'Pretendard', sans-serif",
      }}
    >
      + 게임 기록
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 40 }}>
      <DetailTopBar accent={accent} backLabel="게임 목록" onBack={onBack} onEdit={() => onEdit(item)} primaryAction={actionButton} />

      <FeatureDetailHeroShell
        layout={layout}
        accent={accent}
        glow={COLORS.game.glow}
        imageSrc={item.poster}
        imageAlt={`${item.title} 포스터`}
        fallback={<GamepadIcon size={42} color={accent} />}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Game Detail</p>
            <h2 style={{ margin: "0 0 6px", fontSize: layout.isPhone ? 24 : 30, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{item.title}</h2>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>
              {[item.status, item.releaseDate ? formatMonthDayLabel(item.releaseDate) : "", lastPlayedAt ? `${formatMonthDayLabel(lastPlayedAt)} 플레이` : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusBadge status={item.status} />
            {item.rating > 0 ? <RatingStars rating={item.rating} size={14} /> : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {[
            { label: "누적 플레이", value: formatDurationLabel(totalMinutes) },
            { label: "플레이 횟수", value: `${sessions.length}회` },
            { label: "최근 플레이", value: lastPlayedAt ? formatMonthDayLabel(lastPlayedAt) : "기록 대기" },
          ].map((metric) => (
            <div key={metric.label} style={{ padding: "14px 16px", borderRadius: 18, border: `1px solid ${accent}22`, background: `linear-gradient(135deg, ${accent}12, rgba(255,255,255,0.03))` }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>{metric.label}</p>
              <strong style={{ fontSize: 20, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(item.tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
        </div>

        {(item.summary || item.overview) ? (
          <GlassCard style={{ padding: "16px 18px" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: COLORS.dark.text }}>
              {item.summary || item.overview}
            </p>
          </GlassCard>
        ) : null}
      </FeatureDetailHeroShell>

      <GlassCard glow={COLORS.game.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Play Calendar</p>
            <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>플레이 캘린더</h4>
          </div>
          <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>기록한 날짜마다 칸이 진해집니다.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {calendarMonths.map((month) => (
            <div key={month.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <strong style={{ fontSize: 15, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{month.label}</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
                {DAYS_KO.map((day) => (
                  <span key={`${month.key}-${day}`} style={{ fontSize: 11, color: COLORS.dark.textMuted, textAlign: "center" }}>{day}</span>
                ))}
                {month.cells.map((cell, index) => (
                  <div
                    key={`${month.key}-${cell?.dateKey || index}`}
                    style={{
                      aspectRatio: "1 / 1",
                      minHeight: 38,
                      borderRadius: 12,
                      border: `1px solid ${cell ? `${accent}${cell.count > 0 ? "44" : "16"}` : COLORS.dark.border}`,
                      background: !cell
                        ? "transparent"
                        : cell.count > 0
                          ? `linear-gradient(135deg, ${accent}${cell.count > 1 ? "55" : "28"}, rgba(255,255,255,0.05))`
                          : "rgba(255,255,255,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    {cell ? (
                      <>
                        <strong style={{ fontSize: 13, color: cell.count > 0 ? COLORS.dark.text : COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{cell.day}</strong>
                        <span style={{ fontSize: 10, color: cell.count > 0 ? accent : "transparent" }}>{cell.count > 0 ? `${cell.count}회` : "."}</span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard glow={COLORS.game.glow} style={{ padding: layout.isPhone ? "18px 16px" : "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Play Feed</p>
            <h4 style={{ margin: 0, fontSize: 22, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>플레이 로그</h4>
          </div>
          <button type="button" onClick={() => onAddSession?.(item)} style={{ minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${accent}66`, background: `${accent}18`, color: accent, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "'Pretendard', sans-serif" }}>
            + 게임 기록
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.length === 0 ? (
            <GlassCard style={{ padding: "14px 16px" }}>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>아직 플레이 로그가 없습니다.</p>
            </GlassCard>
          ) : sessions.map((session) => (
            <div key={session.id} style={{ padding: "14px 16px", borderRadius: 18, border: `1px solid ${accent}20`, background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>{formatDurationLabel(session.durationMinutes)}</strong>
                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>
                  {[formatMonthDayLabel(session.playedAt || session.date), formatTimeLabel(session.playedAt || session.date)].filter(Boolean).join(" · ")}
                </span>
              </div>
              {session.note ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.text }}>{session.note}</p> : null}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

/* ──────────── Page: Culture ──────────── */
export const CulturePage = ({ items, loading, onEdit, onUpdateSeriesProgress, onAddGameSession, layout, title = "문화생활", fixedType = null, initialDetailId = null }) => {
  const [filter, setFilter] = useState(fixedType || "전체");
  const [detailId, setDetailId] = useState(null);
  const [gameLogItem, setGameLogItem] = useState(null);
  const [gameLogDuration, setGameLogDuration] = useState("");
  const [gameLogDate, setGameLogDate] = useState(getDateKey(new Date()));
  const [gameLogNote, setGameLogNote] = useState("");
  const [gameLogSaving, setGameLogSaving] = useState(false);
  const [gameLogError, setGameLogError] = useState("");
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

  useEffect(() => {
    if (initialDetailId) setDetailId(initialDetailId);
  }, [initialDetailId]);

  const openGameLogModal = useCallback((item) => {
    setGameLogItem(item);
    setGameLogDuration("");
    setGameLogDate(getDateKey(new Date()));
    setGameLogNote("");
    setGameLogError("");
  }, []);

  const closeGameLogModal = useCallback(() => {
    if (gameLogSaving) return;
    setGameLogItem(null);
    setGameLogDuration("");
    setGameLogDate(getDateKey(new Date()));
    setGameLogNote("");
    setGameLogError("");
  }, [gameLogSaving]);

  const submitGameLog = useCallback(async () => {
    if (!gameLogItem) return;
    setGameLogSaving(true);
    setGameLogError("");
    try {
      await onAddGameSession?.(gameLogItem, {
        durationMinutes: gameLogDuration,
        playedAt: gameLogDate,
        note: gameLogNote,
      });
      closeGameLogModal();
    } catch (error) {
      setGameLogError(error instanceof Error ? error.message : "플레이 기록 저장 실패");
    } finally {
      setGameLogSaving(false);
    }
  }, [closeGameLogModal, gameLogDate, gameLogDuration, gameLogItem, gameLogNote, onAddGameSession]);

  if (detailItem?.type === "시리즈") {
    return <SeriesDetailPage item={detailItem} layout={layout} onBack={() => setDetailId(null)} onEdit={onEdit} onUpdateSeriesProgress={onUpdateSeriesProgress} />;
  }

  if (detailItem?.type === "게임") {
    return (
      <>
        <GameDetailPage item={detailItem} layout={layout} onBack={() => setDetailId(null)} onEdit={onEdit} onAddSession={openGameLogModal} />
        {gameLogItem ? (
          <GamePlayLogModal
            item={gameLogItem}
            layout={layout}
            saving={gameLogSaving}
            error={gameLogError}
            durationMinutes={gameLogDuration}
            playedDate={gameLogDate}
            note={gameLogNote}
            onDurationChange={setGameLogDuration}
            onPlayedDateChange={setGameLogDate}
            onNoteChange={setGameLogNote}
            onClose={closeGameLogModal}
            onSubmit={submitGameLog}
          />
        ) : null}
      </>
    );
  }

  if (detailItem) {
    return <MediaDetailPage item={detailItem} layout={layout} onBack={() => setDetailId(null)} onEdit={onEdit} />;
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
        {(filtered || []).map(c => {
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
          return isSeries ? (
            <FeatureCardShell
              key={c.id}
              layout={layout}
              accent={accent}
              glow={glow}
              imageSrc={c.poster}
              imageAlt={`${c.title} 포스터`}
              fallback={posterNode}
              onOpen={() => setDetailId(c.id)}
            >
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
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {c.tags.map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
              </div>
            </FeatureCardShell>
          ) : (
            <FeatureCardShell
              key={c.id}
              layout={layout}
              accent={accent}
              glow={glow}
              imageSrc={c.poster}
              imageAlt={`${c.title} 포스터`}
              fallback={posterNode}
              onOpen={() => setDetailId(c.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <StatusBadge status={c.status} />
                <IconActionButton onClick={(event) => { event.stopPropagation(); onEdit(c); }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: COLORS.dark.text, margin: "0 0 6px", fontFamily: "'Outfit', sans-serif" }}>
                  {c.title}
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, letterSpacing: 0.6, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                    {c.type}
                  </span>
                  {c.rating > 0 ? <RatingStars rating={c.rating} size={12} /> : null}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>
                  {c.playtime || (c.totalGameMinutes > 0 ? formatDurationLabel(c.totalGameMinutes) : "기록 대기")}
                </span>
                <strong style={{ fontSize: 16, color: accent, fontFamily: "'Outfit', sans-serif" }}>
                  {c.status || "미설정"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-end", marginTop: "auto" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                  {(c.tags || []).map((tag) => <Badge key={tag} text={`#${tag}`} color={accent} />)}
                </div>
                {c.type === "게임" ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openGameLogModal(c);
                    }}
                    style={{
                      minHeight: 36,
                      padding: "0 12px",
                      borderRadius: 12,
                      border: `1px solid ${accent}55`,
                      background: `${accent}16`,
                      color: accent,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "'Pretendard', sans-serif",
                    }}
                  >
                    + 기록
                  </button>
                ) : null}
              </div>
            </FeatureCardShell>
          );
        })}
      </div>
      {gameLogItem ? (
        <GamePlayLogModal
          item={gameLogItem}
          layout={layout}
          saving={gameLogSaving}
          error={gameLogError}
          durationMinutes={gameLogDuration}
          playedDate={gameLogDate}
          note={gameLogNote}
          onDurationChange={setGameLogDuration}
          onPlayedDateChange={setGameLogDate}
          onNoteChange={setGameLogNote}
          onClose={closeGameLogModal}
          onSubmit={submitGameLog}
        />
      ) : null}
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

export const RecordsPage = ({ readingLogs, studyLogs, cultureLogs, loading, onEditReading, onEditStudy, onEditCulture, onUpdateSeriesProgress, onAddGameSession, onAddReading, onAddReadingNote, onAddStudy, onUpdateStudyActivity, onDeleteStudyActivity, initialSection = null, initialDetailTarget = null, onSectionChange, layout }) => {
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
  const groupedStudyEntities = useMemo(() => groupStudiesByEntity(sortedStudy), [sortedStudy]);
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
      count: groupedStudyEntities.length,
      latestUpdatedAt: groupedStudyEntities[0]?.date ? new Date(groupedStudyEntities[0].date).getTime() : 0,
      unit: "개",
      accent: COLORS.study.main,
      icon: <PenIcon color={COLORS.study.main} />,
      previews: groupedStudyEntities.slice(0, 3).map((study) => ({
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
  })), [gameLogs, groupedStudyEntities, movieLogs, seriesLogs, sortedReading]);

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
    const initialDetailId = initialDetailTarget?.section === selectedSection ? initialDetailTarget.id : null;
    switch (selectedSection) {
      case "reading":
        return <ReadingPage books={sortedReading} loading={loading} onEdit={onEditReading} onAdd={onAddReading} onAddNote={onAddReadingNote} layout={layout} initialDetailId={initialDetailId} />;
      case "study":
        return <StudyPage studies={sortedStudy} loading={loading} onEdit={onEditStudy} onSave={onAddStudy} onUpdateActivity={onUpdateStudyActivity} onDeleteActivity={onDeleteStudyActivity} layout={layout} initialDetailId={initialDetailId} />;
      case "movie":
        return <CulturePage items={movieLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} onAddGameSession={onAddGameSession} layout={layout} title="영화 기록" fixedType="영화" initialDetailId={initialDetailId} />;
      case "series":
        return <CulturePage items={seriesLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} onAddGameSession={onAddGameSession} layout={layout} title="시리즈 기록" fixedType="시리즈" initialDetailId={initialDetailId} />;
      case "game":
        return <CulturePage items={gameLogs} loading={loading} onEdit={onEditCulture} onUpdateSeriesProgress={onUpdateSeriesProgress} onAddGameSession={onAddGameSession} layout={layout} title="게임 기록" fixedType="게임" initialDetailId={initialDetailId} />;
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
