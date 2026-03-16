import {
  COLORS,
  safeNumber,
  clamp,
  normalizeCultureType,
  getCultureTone,
  formatTimeLabel,
  getSeriesProgressMetrics,
} from "./core";

/**
 * 개별 로그 항목을 UI용 아이템 객체로 변환합니다.
 */
export const mapLogToUiItem = (log) => {
  const payload = log.payload || {};
  const entity = log.entity || {};
  const entityMetadata = entity.entity_metadata || {};
  
  // 카테고리 및 색상 결정
  const category = log.category;
  const cultureType = category === "culture" ? normalizeCultureType(payload.type || entity.category) : null;
  const typeLabel = category === "reading" ? "독서" : category === "study" ? "공부" : cultureType;
  
  const accent = category === "reading"
    ? COLORS.reading.main
    : category === "study"
      ? COLORS.study.main
      : getCultureTone(cultureType).main;

  // 제목: 로그 자체 제목이 있으면 사용, 없으면 엔티티 제목 사용
  const title = log.title || entity.title || "제목 없음";

  // 포스터/커버 이미지 결정
  const poster = entityMetadata.cover || entityMetadata.poster || entityMetadata.image_url || payload.cover || payload.poster || payload.image_url || null;

  // 진행률 및 요약 정보 계산 (기존 로직 이관)
  let summary = "";
  let progress = null;
  let progressStart = 0;
  let progressEnd = 0;

  if (category === "reading") {
    const pagesRead = safeNumber(payload.pages_read || payload.readPages);
    const pagesTotal = safeNumber(entityMetadata.pages_total || payload.pages_total || payload.pages);
    summary = `${pagesRead} / ${pagesTotal > 0 ? `${pagesTotal}p` : "?"}`;
    progress = pagesTotal > 0 ? clamp(Math.round((pagesRead / pagesTotal) * 100), 0, 100) : 0;
    
    // 이전 기록과의 델타 계산을 위해 progressStart 추정 (간소화)
    progressEnd = progress;
    progressStart = Math.max(0, progress - safeNumber(payload.progress_delta, 0));
  } else if (category === "study") {
    const progressMode = payload.progress_mode || "chapter";
    if (progressMode === "page") {
      const pagesRead = safeNumber(payload.pages_read);
      const pagesTotal = safeNumber(entityMetadata.pages_total || payload.pages_total);
      summary = `${pagesRead} / ${pagesTotal}p`;
      progress = pagesTotal > 0 ? Math.round((pagesRead / pagesTotal) * 100) : 0;
    } else {
      progress = clamp(safeNumber(payload.progress), 0, 100);
      summary = `${progress}% 완료`;
    }
    progressEnd = progress;
    progressStart = progress; // 공부는 일단 동일하게 표시
  } else if (cultureType === "시리즈") {
    const metrics = getSeriesProgressMetrics({
      episodeCount: entityMetadata.episode_count || payload.episode_count,
      seasons: entityMetadata.seasons || payload.seasons,
      watchedEpisodes: payload.watched_episode_count,
      progress: payload.progress,
    });
    summary = metrics.playtimeLabel || `${payload.watched_episode_count || 0}화 시청`;
    progress = metrics.progress;
    progressEnd = progress;
    progressStart = Math.max(0, progress - safeNumber(payload.progress_delta, 0));
  } else {
    summary = payload.playtime || payload.status || "";
  }

  return {
    id: log.id,
    entityId: log.entity_id,
    title,
    time: formatTimeLabel(log.occurred_at || log.created_at),
    accent,
    type: cultureType || category,
    categoryLabel: typeLabel,
    summary,
    snippet: log.summary || "",
    progress,
    progressStart,
    progressEnd,
    status: payload.status || "",
    poster,
    occurredAt: log.occurred_at || log.created_at,
  };
};

/**
 * 로그 목록을 날짜별 그룹으로 묶습니다.
 */
export const groupLogsByDate = (logs) => {
  if (!Array.isArray(logs)) return [];
  
  const sorted = [...logs].sort((a, b) => new Date(b.occurred_at || b.created_at) - new Date(a.occurred_at || a.created_at));
  
  return sorted.reduce((acc, log) => {
    const dateObj = new Date(log.occurred_at || log.created_at);
    const key = dateObj.toISOString().split("T")[0];
    const item = mapLogToUiItem(log);
    
    const existing = acc.find((g) => g.key === key);
    if (existing) {
      existing.items.push(item);
    } else {
      acc.push({
        key,
        date: dateObj,
        dayNumber: String(dateObj.getDate()).padStart(2, "0"),
        sideLabel: `${dateObj.getMonth() + 1}월 · ${["일","월","화","수","목","금","토"][dateObj.getDay()]}요일`,
        items: [item],
      });
    }
    return acc;
  }, []);
};
