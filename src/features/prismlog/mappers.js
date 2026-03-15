import {
  clamp,
  formatMonthDayLabel,
  getSeriesPlatformLabel,
  getSeriesProgressMetrics,
  normalizeCultureType,
  normalizeEpisodeWatchDates,
  normalizeMetadataObject,
  safeNumber,
} from "./core";

const normalizeReadingSession = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const date = String(entry.ended_at || entry.endedAt || entry.date || entry.updated_at || "").trim();
  if (!date) return null;
  const startedAt = String(entry.started_at || entry.startedAt || date).trim();
  const endedAt = String(entry.ended_at || entry.endedAt || date).trim();
  return {
    id: String(entry.id || `${date}-${safeNumber(entry.to_pages, 0)}`),
    date,
    dateLabel: formatMonthDayLabel(date),
    fromPages: safeNumber(entry.from_pages ?? entry.fromPages, 0),
    toPages: safeNumber(entry.to_pages ?? entry.toPages, 0),
    totalPages: safeNumber(entry.total_pages ?? entry.totalPages, 0),
    pagesRead: safeNumber(entry.pages_read ?? entry.pagesRead, 0),
    fromProgress: clamp(safeNumber(entry.from_progress ?? entry.fromProgress, 0), 0, 100),
    toProgress: clamp(safeNumber(entry.to_progress ?? entry.toProgress, 0), 0, 100),
    progressDelta: safeNumber(entry.progress_delta ?? entry.progressDelta, 0),
    startedAt,
    endedAt,
    durationMinutes: safeNumber(entry.duration_minutes ?? entry.durationMinutes, 0),
  };
};

const normalizeReadingNote = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const date = String(entry.date || "").trim();
  const text = String(entry.text || "").trim();
  if (!date || !text) return null;
  return {
    id: String(entry.id || `${date}-${text.slice(0, 12)}`),
    date,
    dateLabel: formatMonthDayLabel(date),
    page: safeNumber(entry.page, 0),
    text,
  };
};

export const mapReadingLog = (log) => {
  const payload = log.payload || {};
  const pages = safeNumber(payload.pages_total || payload.pages);
  const readPages = safeNumber(payload.pages_read || payload.readPages);
  const computed = pages > 0 ? Math.round((readPages / pages) * 100) : 0;
  const progress = clamp(safeNumber(payload.progress, computed), 0, 100);
  return {
    id: log.id,
    title: log.title,
    summary: log.summary || "",
    author: payload.author || "저자 정보 없음",
    publisher: payload.publisher || "",
    isbn: payload.isbn13 || payload.isbn || "",
    publishedDate: payload.published_date || "",
    description: payload.description || "",
    cover: payload.cover || null,
    medium: payload.medium || "paper",
    ebookService: payload.ebook_service || "",
    ebookProgressMode: payload.progress_mode || "page",
    readingStatus: payload.reading_status || "reading",
    progressValue: safeNumber(payload.progress_value, progress),
    sourceProvider: payload.source_provider || "",
    sourceId: payload.source_id || "",
    enrichmentProvider: payload.enrichment_provider || "",
    sourceMetadata: normalizeMetadataObject(payload.source_metadata),
    progress,
    pages,
    readPages,
    readingSessions: Array.isArray(payload.reading_sessions)
      ? payload.reading_sessions.map(normalizeReadingSession).filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date))
      : [],
    readingNotes: Array.isArray(payload.reading_notes)
      ? payload.reading_notes.map(normalizeReadingNote).filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date))
      : [],
    rating: clamp(safeNumber(payload.rating), 0, 5),
    review: payload.review || log.summary || "",
    tags: Array.isArray(log.tags) ? log.tags : [],
    date: log.created_at,
  };
};

export const mapStudyLog = (log) => {
  const payload = log.payload || {};
  const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
  const completed = Array.isArray(payload.completed) ? payload.completed : chapters.map(() => false);
  const doneCount = completed.filter(Boolean).length;
  const computed = chapters.length > 0 ? Math.round((doneCount / chapters.length) * 100) : 0;
  return {
    id: log.id,
    title: log.title,
    summary: log.summary || "",
    progress: clamp(safeNumber(payload.progress, computed), 0, 100),
    chapters,
    completed,
    goal: payload.goal || "학습 목표 미설정",
    imageUrl: payload.image_url || payload.imageUrl || null,
    date: log.created_at,
    tags: Array.isArray(log.tags) ? log.tags : [],
    hours: safeNumber(payload.hours),
  };
};

export const mapCultureLog = (log) => {
  const payload = log.payload || {};
  const type = normalizeCultureType(payload.type);
  const seriesMetrics = type === "시리즈"
    ? getSeriesProgressMetrics({
      episodeCount: payload.episode_count,
      seasons: payload.seasons,
      watchedEpisodes: payload.watched_episode_count,
      playtime: payload.playtime,
      progress: payload.progress,
    })
    : null;
  return {
    id: log.id,
    title: log.title,
    summary: log.summary || "",
    overview: payload.overview || log.summary || "",
    type,
    status: payload.status || (type === "게임" ? "플레이 중" : "시청 중"),
    poster: payload.poster || null,
    releaseDate: payload.release_date || null,
    sourceProvider: payload.source_provider || "",
    sourceId: payload.source_id || "",
    tmdbId: payload.tmdb_id || null,
    igdbId: payload.igdb_id || null,
    episodeCount: safeNumber(payload.episode_count, 0) || null,
    seasonCount: safeNumber(payload.season_count, 0) || null,
    runtime: safeNumber(payload.runtime, 0) || null,
    seasons: seriesMetrics?.seasons || [],
    episodeWatchDates: normalizeEpisodeWatchDates(payload.episode_watch_dates),
    platformKey: payload.platform_key || "",
    platformLabel: getSeriesPlatformLabel(payload.platform_key, payload.platform_label || ""),
    watchedEpisodes: seriesMetrics?.watchedEpisodes ?? safeNumber(payload.watched_episode_count, 0),
    progress: seriesMetrics?.progress ?? clamp(safeNumber(payload.progress), 0, 100),
    rating: clamp(safeNumber(payload.rating), 0, 5),
    date: log.created_at,
    tags: Array.isArray(log.tags) ? log.tags : [],
    playtime: type === "시리즈" ? seriesMetrics?.playtimeLabel || payload.playtime || null : payload.playtime || null,
  };
};
