import { useState, useEffect } from "react";

/* ──────────── Color Tokens ──────────── */
export const CATEGORY_COLORS = (() => {
  const reading = { main: "#2db5a3", glow: "rgba(45,181,163,0.35)", light: "#3fd4bf" };
  const study = { main: "#f0c930", glow: "rgba(240,201,48,0.35)", light: "#f7da5e" };
  const culture = { main: "#e63946", glow: "rgba(230,57,70,0.35)", light: "#f25d69" };
  const series = { main: "#ff8a65", glow: "rgba(255,138,101,0.35)", light: "#ffab91" };
  const game = { main: "#7c9cf5", glow: "rgba(124,156,245,0.35)", light: "#a7bcff" };

  return {
    reading,
    study,
    culture,
    movie: culture,
    series,
    game,
  };
})();

export const COLORS = {
  dark: {
    bg: "#1a1816",
    surface: "rgba(40, 36, 33, 0.7)",
    surfaceSolid: "#282421",
    card: "rgba(50, 45, 41, 0.55)",
    text: "#f5f0eb",
    textMuted: "#a09890",
    border: "rgba(255,255,255,0.07)",
    glassBlur: "blur(18px)",
  },
  ...CATEGORY_COLORS,
};

export const CATEGORY_KEYS = ["reading", "study", "culture"];
export const CATEGORY_META = {
  reading: { label: "독서", color: COLORS.reading.main },
  study: { label: "공부", color: COLORS.study.main },
  culture: { label: "문화", color: COLORS.culture.main },
};

export const NAV_TAB_COLORS = {
  home: COLORS.reading.main,
  records: COLORS.study.main,
  timeline: COLORS.culture.main,
  settings: COLORS.dark.text,
};

export const CULTURE_TYPE_COLORS = {
  영화: COLORS.movie,
  시리즈: COLORS.series,
  게임: COLORS.game,
};

export const getCultureTone = (type) => CULTURE_TYPE_COLORS[type] || COLORS.movie;

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

export const getViewportWidth = () => (typeof window === "undefined" ? 1280 : window.innerWidth);

export const getResponsiveMode = (width) => {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "phone";
};

export const getResponsiveColumns = (layout, { phone = 1, tablet = phone, desktop = tablet }) => {
  if (layout.isDesktop) return desktop;
  if (layout.isTablet) return tablet;
  return phone;
};

export const useResponsiveLayout = () => {
  const [width, setWidth] = useState(getViewportWidth);

  useEffect(() => {
    const handleResize = () => setWidth(getViewportWidth());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mode = getResponsiveMode(width);
  return {
    width,
    mode,
    isPhone: mode === "phone",
    isTablet: mode === "tablet",
    isDesktop: mode === "desktop",
    isTabletUp: width >= BREAKPOINTS.tablet,
  };
};

/* ──────────── Icons (inline SVG) ──────────── */
export const BookIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
export const PenIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
export const FilmIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);
export const PlusIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const CalendarIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
export const TagIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
export const ChevronDown = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
);
export const StarIcon = ({ size = 16, filled = false, color = COLORS.study.main }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
export const XIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const HomeIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
export const BarChartIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
export const CheckIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
);
export const ListIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <circle cx="3" cy="6" r="1" fill={color} stroke="none"/><circle cx="3" cy="12" r="1" fill={color} stroke="none"/><circle cx="3" cy="18" r="1" fill={color} stroke="none"/>
  </svg>
);
export const TabletIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <line x1="9" y1="5.5" x2="15" y2="5.5" />
    <circle cx="12" cy="18" r="0.7" fill={color} stroke="none" />
  </svg>
);
export const GridIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
export const ClockIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);
export const SettingsIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-.97-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.97H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.46-.97 1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.32h.01A1.6 1.6 0 0 0 9.79 3.1V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.76v.01a1.6 1.6 0 0 0 1.46.97H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.46.97Z" />
  </svg>
);
export const GamepadIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 10h12a4 4 0 0 1 3.7 5.5l-1.2 3a2.5 2.5 0 0 1-4.12.82L13.9 17H10.1l-2.48 2.32a2.5 2.5 0 0 1-4.12-.82l-1.2-3A4 4 0 0 1 6 10Z" />
    <line x1="8" y1="13" x2="8" y2="17" />
    <line x1="6" y1="15" x2="10" y2="15" />
    <circle cx="16.5" cy="14.5" r="1" fill={color} stroke="none" />
    <circle cx="18.5" cy="16.5" r="1" fill={color} stroke="none" />
  </svg>
);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || ((typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
    ? "http://127.0.0.1:8001"
    : "")
).replace(/\/$/, "");
export const DEMO_USER_ID = import.meta.env.VITE_DEMO_USER_ID || "demo-user";
export const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const CULTURE_TYPES = ["영화", "시리즈", "게임"];
export const EBOOK_SERVICES = [
  { key: "ridi", label: "리디북스" },
  { key: "millie", label: "밀리의서재" },
  { key: "kyobo", label: "교보 eBook" },
  { key: "aladin", label: "알라딘" },
  { key: "yes24", label: "yes24" },
];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
export const normalizeMetadataObject = (value) => (
  value && typeof value === "object" && !Array.isArray(value) ? value : {}
);
export const ENRICHMENT_PROVIDER_LABELS = {
  google_books: "Google Books",
  nl_isbn: "국립중앙도서관",
};

export const createReadingFormState = () => ({
  title: "",
  author: "",
  publisher: "",
  isbn: "",
  publishedDate: "",
  description: "",
  cover: "",
  medium: "paper",
  ebookService: "",
  ebookProgressMode: "page",
  readingStatus: "reading",
  readPages: "",
  pages: "",
  progressValue: "0",
  memo: "",
  review: "",
  rating: 0,
  tags: "",
  sourceProvider: "",
  sourceId: "",
  enrichmentProvider: "",
  sourceMetadata: {},
});

export const extractIsbn13 = (value) => {
  const matches = String(value || "").match(/\d{13}/g);
  return matches?.[0] || "";
};

export const getReadingMetrics = (form) => {
  const readPages = safeNumber(form.readPages);
  const pages = safeNumber(form.pages);
  const progress = pages > 0 ? clamp(Math.round((readPages / pages) * 100), 0, 100) : 0;
  return { readPages, pages, progress };
};

export const clearReadingMetadata = (form) => ({
  ...form,
  author: "",
  publisher: "",
  isbn: "",
  publishedDate: "",
  description: "",
  cover: "",
  pages: "",
  readPages: form.readingStatus === "planned" ? "0" : "",
  progressValue: form.readingStatus === "finished" ? "100" : "0",
  sourceProvider: "",
  sourceId: "",
  enrichmentProvider: "",
  sourceMetadata: {},
});

export const applyBookSelectionToReadingForm = (form, book) => {
  const nextPages = book.pages_total ? String(book.pages_total) : "";
  const nextProgressValue = form.readingStatus === "finished" ? "100" : form.readingStatus === "planned" ? "0" : "0";
  const nextReadPages = form.readingStatus === "finished" ? nextPages : form.readingStatus === "planned" ? "0" : "";
  return {
    ...form,
    title: book.title || form.title,
    author: Array.isArray(book.authors) ? book.authors.join(", ") : form.author,
    publisher: book.publisher || "",
    isbn: book.isbn13 || book.isbn || "",
    publishedDate: book.published_date || "",
    description: book.description || "",
    cover: book.cover_url || "",
    pages: nextPages,
    readPages: nextReadPages,
    progressValue: nextProgressValue,
    sourceProvider: book.source_provider || "",
    sourceId: book.source_id || "",
    enrichmentProvider: "",
    sourceMetadata: {},
  };
};

export const applyPageEnrichmentToReadingForm = (form, pages) => {
  const nextPages = String(pages);
  if (form.readingStatus === "finished") {
    return { ...form, pages: nextPages, readPages: nextPages, progressValue: "100" };
  }
  if (form.readingStatus === "planned") {
    return { ...form, pages: nextPages, readPages: "0", progressValue: "0" };
  }
  const hasReadPages = String(form.readPages ?? "").trim() !== "";
  const nextReadPages = hasReadPages ? String(Math.min(safeNumber(form.readPages), pages)) : "";
  return {
    ...form,
    pages: nextPages,
    readPages: nextReadPages,
  };
};

export const applyBookEnrichmentToReadingForm = (form, enrichment) => {
  const metadata = normalizeMetadataObject(enrichment?.source_metadata);
  const nextForm = {
    ...form,
    title: enrichment?.title || form.title,
    author: Array.isArray(enrichment?.authors) && enrichment.authors.length > 0
      ? enrichment.authors.join(", ")
      : form.author,
    publisher: enrichment?.publisher || form.publisher,
    isbn: form.isbn || enrichment?.isbn || "",
    publishedDate: enrichment?.published_date || form.publishedDate,
    description: enrichment?.description || form.description,
    cover: enrichment?.cover_url || form.cover,
    enrichmentProvider: enrichment?.source_provider || form.enrichmentProvider,
    sourceMetadata: Object.keys(metadata).length > 0
      ? { ...normalizeMetadataObject(form.sourceMetadata), ...metadata }
      : normalizeMetadataObject(form.sourceMetadata),
  };
  const pages = safeNumber(enrichment?.pages_total);
  return pages > 0 ? applyPageEnrichmentToReadingForm(nextForm, pages) : nextForm;
};

export const hasReadingEnrichmentMetadata = (enrichment) => {
  const metadata = normalizeMetadataObject(enrichment?.source_metadata);
  return Boolean(
    enrichment?.title
      || enrichment?.publisher
      || enrichment?.published_date
      || enrichment?.description
      || enrichment?.cover_url
      || (Array.isArray(enrichment?.authors) && enrichment.authors.length > 0)
      || Object.keys(metadata).length > 0
  );
};

export const getReadingEnrichmentMessage = (enrichment) => {
  const pages = safeNumber(enrichment?.pages_total);
  if (pages > 0) {
    return `전체 페이지를 자동으로 불러왔습니다. (${pages}p)`;
  }
  if (hasReadingEnrichmentMetadata(enrichment)) {
    return "페이지 수는 찾지 못했지만 메타데이터를 보강했습니다.";
  }
  return "자동 입력 실패: 해당 ISBN으로 페이지 정보를 찾지 못했습니다.";
};

export const formatReadingSourceSummary = (sourceProvider, enrichmentProvider) => {
  const searchLabel = sourceProvider ? `${sourceProvider.toUpperCase()} 검색` : "";
  const enrichLabel = enrichmentProvider ? `${ENRICHMENT_PROVIDER_LABELS[enrichmentProvider] || enrichmentProvider} 보강` : "";
  return [searchLabel, enrichLabel].filter(Boolean).join(" · ") || "수동 입력";
};

export const buildReadingPayload = (form) => {
  const pages = safeNumber(form.pages);
  const isPercentMode = form.medium === "ebook" && form.ebookProgressMode === "percent";
  const progressValue = clamp(safeNumber(form.progressValue), 0, 100);
  const readPages = isPercentMode
    ? (pages > 0 ? Math.round((progressValue / 100) * pages) : 0)
    : safeNumber(form.readPages);
  const progress = isPercentMode
    ? progressValue
    : pages > 0 ? clamp(Math.round((readPages / pages) * 100), 0, 100) : 0;
  return {
    author: form.author.trim(),
    publisher: form.publisher.trim() || null,
    isbn: form.isbn.trim() || null,
    isbn13: extractIsbn13(form.isbn) || null,
    published_date: form.publishedDate.trim() || null,
    description: form.description.trim() || null,
    cover: form.cover.trim() || null,
    medium: form.medium || "paper",
    ebook_service: form.medium === "ebook" ? form.ebookService || null : null,
    progress_mode: form.medium === "ebook" ? form.ebookProgressMode || "page" : "page",
    reading_status: form.readingStatus || "reading",
    progress_value: isPercentMode ? progressValue : null,
    source_provider: form.sourceProvider || null,
    source_id: form.sourceId || null,
    enrichment_provider: form.enrichmentProvider || null,
    source_metadata: Object.keys(normalizeMetadataObject(form.sourceMetadata)).length > 0
      ? normalizeMetadataObject(form.sourceMetadata)
      : null,
    pages_read: readPages,
    pages_total: pages,
    progress,
    rating: clamp(safeNumber(form.rating), 0, 5),
    review: form.review.trim(),
  };
};

export const fetchReadingEnrichment = async (apiBaseUrl, isbn) => {
  const normalized = String(isbn || "").replace(/[^\dXx]/g, "");
  if (!normalized) return null;
  const response = await fetch(
    `${apiBaseUrl}/api/v1/books/enrich?isbn=${encodeURIComponent(normalized)}`
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const pages = Number(payload?.pages_total);
  return {
    ...payload,
    pages_total: Number.isFinite(pages) && pages > 0 ? pages : null,
    authors: Array.isArray(payload?.authors) ? payload.authors.filter(Boolean) : [],
    source_metadata: normalizeMetadataObject(payload?.source_metadata),
  };
};

export const createCultureFormState = () => ({
  title: "",
  type: "영화",
  status: "시청 중",
  rating: 0,
  playtime: "",
  tags: "",
  poster: "",
  releaseDate: "",
  overview: "",
  sourceProvider: "",
  sourceId: "",
  tmdbId: null,
  igdbId: null,
  episodeCount: null,
  seasonCount: null,
  runtime: null,
});

export const applyCultureSelectionToForm = (form, media) => ({
  ...form,
  title: media.title || form.title,
  poster: media.poster_url || "",
  releaseDate: media.release_date || "",
  overview: media.overview || "",
  sourceProvider: media.source_provider || "",
  sourceId: media.source_id || "",
  tmdbId: media.tmdb_id || null,
  igdbId: media.igdb_id || null,
});

export const fetchMediaEnrichment = async (apiBaseUrl, tmdbId, type) => {
  if (!tmdbId || !["movie", "series"].includes(type)) return null;
  const response = await fetch(
    `${apiBaseUrl}/api/v1/media/enrich?tmdb_id=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(type)}`
  );
  if (!response.ok) return null;
  return response.json();
};

export const clearCultureMetadata = (form) => ({
  ...form,
  poster: "",
  releaseDate: "",
  overview: "",
  sourceProvider: "",
  sourceId: "",
  tmdbId: null,
  igdbId: null,
  episodeCount: null,
  seasonCount: null,
  runtime: null,
});

export const normalizeCultureType = (value) => {
  if (!value) return "영화";
  if (value === "TV" || value === "드라마" || value === "시리즈") return "시리즈";
  if (value === "게임") return "게임";
  return "영화";
};

export const getCultureStatusOptions = (type) => (
  normalizeCultureType(type) === "게임"
    ? ["플레이 중", "플레이 완료", "중도 하차", "기대 중"]
    : ["시청 중", "시청 완료", "중도 하차", "기대 중"]
);

export const formatKoreanDateLabel = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${DAYS_KO[date.getDay()]}요일`;
};

export const formatMonthDayLabel = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export const formatTimeLabel = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const getDateKey = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const formatRelativeTime = (isoLike) => {
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  return `${diff}일 전`;
};

export const buildHeatmapMatrix = (logs) => {
  const matrix = Array.from({ length: 5 }, () => Array(7).fill(0));
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - 34);
  start.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  logs.forEach((log) => {
    const date = new Date(log.created_at);
    if (Number.isNaN(date.getTime()) || date < start || date > today) return;
    const dayDiff = Math.floor((date - start) / dayMs);
    const week = clamp(Math.floor(dayDiff / 7), 0, 4);
    const day = (date.getDay() + 6) % 7;
    matrix[week][day] = clamp(matrix[week][day] + 1, 0, 3);
  });

  return matrix;
};

export const buildTrendSeries = (logs, days = 14) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  const series = Array.from({ length: days }, (_, idx) => {
    const date = new Date(start.getTime() + idx * dayMs);
    return {
      date,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      reading: 0,
      study: 0,
      culture: 0,
    };
  });

  logs.forEach((log) => {
    const date = new Date(log.created_at);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return;
    const idx = Math.floor((date - start) / dayMs);
    if (idx < 0 || idx >= days) return;
    if (!CATEGORY_KEYS.includes(log.category)) return;
    series[idx][log.category] += 1;
  });

  return series;
};

export const parseTags = (raw) =>
  raw
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
