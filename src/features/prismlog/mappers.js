import { clamp, normalizeCultureType, safeNumber } from "./core";

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
    progress,
    pages,
    readPages,
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
  return {
    id: log.id,
    title: log.title,
    summary: log.summary || "",
    type,
    status: payload.status || (type === "게임" ? "플레이 중" : "시청 중"),
    poster: payload.poster || null,
    rating: clamp(safeNumber(payload.rating), 0, 5),
    date: log.created_at,
    tags: Array.isArray(log.tags) ? log.tags : [],
    playtime: payload.playtime || null,
  };
};
