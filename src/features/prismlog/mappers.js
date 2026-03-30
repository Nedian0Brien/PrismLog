import {
  COLORS,
  safeNumber,
  clamp,
  normalizeCultureType,
  getCultureTone,
  formatTimeLabel,
  getSeriesProgressMetrics,
  normalizeSeriesSeasons,
  normalizeEpisodeWatchDates,
} from "./core";

/**
 * 개별 로그 항목을 UI용 객체로 변환합니다.
 * 엔티티 정보(entity_metadata)와 로그 정보(payload)를 병합하여 하위 호환성을 유지합니다.
 */
export const mapLogToUiItem = (log) => {
  if (!log) return null;

  const payload = log.payload || {};
  const entity = log.entity || {};
  const entityMetadata = entity.entity_metadata || {};
  
  // 데이터 병합 전략: 로그의 payload를 기본으로 하되, 엔티티 정보가 있으면 덮어씌움 (또는 보완)
  // 하지만 기존 데이터는 payload에만 정보가 있으므로 payload를 우선적으로 살려야 함
  const combined = { ...entityMetadata, ...payload };

  // 카테고리 및 색상 결정
  const category = log.category;
  const cultureType = category === "culture" ? normalizeCultureType(combined.type || entity.category) : null;
  const typeLabel = category === "reading" ? "독서" : category === "study" ? "공부" : cultureType;
  
  const accent = category === "reading"
    ? COLORS.reading.main
    : category === "study"
      ? COLORS.study.main
      : getCultureTone(cultureType).main;

  // 제목 결정: 로그 제목 -> 엔티티 제목 -> 페이로드 제목 순
  const title = log.title || entity.title || combined.title || "제목 없음";

  // 포스터/커버 이미지: UI에서 cover와 poster 두 이름을 모두 사용하므로 둘 다 제공
  const cover = combined.cover || combined.poster || combined.image_url || combined.imageUrl || null;

  // --- 독서 데이터 가공 ---
  const pagesRead = safeNumber(combined.pages_read || combined.readPages);
  const pagesTotal = safeNumber(combined.pages_total || combined.pages);
  
  // 진행률 계산
  let progress = safeNumber(combined.progress, 0);
  if (category === "reading" && pagesTotal > 0) {
    progress = clamp(Math.round((pagesRead / pagesTotal) * 100), 0, 100);
  }
  
  // 세션 데이터 필드명 변환 (snake_case -> camelCase) 및 하위 호환성
  const rawSessions = Array.isArray(combined.reading_sessions) ? combined.reading_sessions : (Array.isArray(combined.readingSessions) ? combined.readingSessions : []);
  const readingSessions = rawSessions.map(s => ({
    ...s,
    pagesRead: safeNumber(s.pages_read || s.pagesRead),
    fromPages: safeNumber(s.from_pages || s.fromPages),
    toPages: safeNumber(s.to_pages || s.toPages),
    fromProgress: safeNumber(s.from_progress || s.fromProgress),
    toProgress: safeNumber(s.to_progress || s.toProgress),
    progressDelta: safeNumber(s.progress_delta || s.progressDelta),
    durationMinutes: safeNumber(s.duration_minutes || s.durationMinutes),
    endedAt: s.ended_at || s.endedAt || s.date,
  }));

  // 만약 세션이 하나도 없는데 진행도가 있다면, 최초 생성 시점의 가상 세션 추가 (소급 적용 및 타임라인 노출용)
  if (readingSessions.length === 0 && (pagesRead > 0 || progress > 0)) {
    const creationDate = combined.date || combined.occurred_at || combined.created_at;
    readingSessions.push({
      id: `virtual-initial-${combined.id}`,
      pagesRead: pagesRead,
      fromPages: 0,
      toPages: pagesRead,
      fromProgress: 0,
      toProgress: progress,
      progressDelta: progress,
      date: creationDate,
      endedAt: creationDate,
      durationMinutes: 0,
    });
  }

  const rawNotes = Array.isArray(combined.reading_notes) ? combined.reading_notes : (Array.isArray(combined.readingNotes) ? combined.readingNotes : []);
  const readingNotes = rawNotes.map(n => ({
    ...n,
    date: n.date || n.created_at,
  }));

  const rawGameSessions = Array.isArray(combined.game_sessions) ? combined.game_sessions : (Array.isArray(combined.gameSessions) ? combined.gameSessions : []);
  const gameSessions = rawGameSessions.map((session) => ({
    ...session,
    date: session.date || session.played_at || session.playedAt || session.created_at || null,
    playedAt: session.played_at || session.playedAt || session.date || null,
    durationMinutes: safeNumber(session.duration_minutes || session.durationMinutes),
    note: String(session.note || "").trim(),
    photos: Array.isArray(session.photos) ? session.photos : [],
  }));
  const totalGameMinutes = gameSessions.reduce((sum, session) => sum + safeNumber(session.durationMinutes), 0);
  const derivedGamePlaytime = cultureType === "게임" && totalGameMinutes > 0
    ? `${Math.floor(totalGameMinutes / 60)}시간 ${String(totalGameMinutes % 60).padStart(2, "0")}분`
    : "";

  // --- 시리즈 데이터 가공 ---
  const seasons = normalizeSeriesSeasons(combined.seasons);
  const episodeWatchDates = normalizeEpisodeWatchDates(combined.episode_watch_dates || combined.episodeWatchDates);
  const metrics = cultureType === "시리즈" ? getSeriesProgressMetrics({
    episodeCount: combined.episode_count || combined.episodeCount,
    seasons: seasons,
    watchedEpisodes: combined.watched_episode_count || combined.watchedEpisodes,
    playtime: combined.playtime,
    progress: combined.progress,
  }) : null;

  // --- 공부 TOC 데이터 가공 (트리 구조로 통합) ---
  let toc = Array.isArray(combined.toc) ? combined.toc : [];
  if (toc.length === 0 && Array.isArray(combined.chapters) && combined.chapters.length > 0) {
    const completedArr = Array.isArray(combined.completed) ? combined.completed : [];
    toc = combined.chapters.map((chapterTitle, idx) => ({
      id: `node-legacy-${idx}`,
      title: chapterTitle,
      completed: !!completedArr[idx],
      notes: "",
      children: [],
    }));
  }

  if (category === "study") {
    const progressMode = combined.progress_mode || "page";
    if (progressMode === "page" && pagesTotal > 0) {
      progress = clamp(Math.round((pagesRead / pagesTotal) * 100), 0, 100);
    } else {
      if (toc.length > 0) {
        const walk = (items) => items.reduce(
          (sum, entry) => sum + (entry.completed ? 1 : 0) + walk(entry.children || []),
          0,
        );
        const walkTotal = (items) => items.reduce(
          (sum, entry) => sum + 1 + walkTotal(entry.children || []),
          0,
        );
        const completedCount = walk(toc);
        const totalCount = walkTotal(toc);
        if (totalCount > 0) {
          progress = clamp(Math.round((completedCount / totalCount) * 100), 0, 100);
        }
      } else {
        const chapters = Array.isArray(combined.chapters) ? combined.chapters : [];
        const completed = Array.isArray(combined.completed) ? combined.completed : [];
        if (chapters.length > 0) {
          const completedCount = completed.filter(Boolean).length;
          progress = clamp(Math.round((completedCount / chapters.length) * 100), 0, 100);
        }
      }
    }
  } else if (metrics) {
    progress = metrics.progress;
  }

  // 델타 애니메이션용 시작값 추정
  const progressDelta = safeNumber(combined.progress_delta || combined.progressDelta, 0);
  const progressStart = clamp(progress - progressDelta, 0, 100);

  return {
    // 원본 데이터 필드들을 그대로 노출 (RecordsPage 호환성)
    ...combined,
    id: log.id,
    entityId: log.entity_id,
    entityTitle: entity.title || "",
    activityTitle: log.title || "",
    user_id: log.user_id,
    category: log.category,
    title,
    summary: log.summary || "",
    tags: Array.isArray(log.tags) ? log.tags : [],
    
    // UI 전용 가공 필드
    time: formatTimeLabel(log.occurred_at || log.created_at),
    accent,
    type: cultureType || category,
    categoryLabel: typeLabel,
    cover, // 독서 탭용
    poster: cover, // 문화 탭용
    imageUrl: cover, // 공부 탭 및 EditSheet 호환성용
    pages: pagesTotal,
    pagesTotal, // Study UI 호환성용
    readPages: pagesRead,
    pagesRead, // Study UI 호환성용
    progressMode: combined.progressMode || combined.progress_mode || "page",
    progress,
    progressStart,
    progressEnd: progress,
    readingSessions,
    readingNotes,
    gameSessions,
    seasons,
    episodeWatchDates,
    toc, // 가공된 목차 데이터 추가
    hours: safeNumber(combined.hours, 0),
    totalGameMinutes,
    lastPlayedAt: gameSessions[0]?.playedAt || gameSessions[0]?.date || combined.last_played_at || combined.lastPlayedAt || null,
    playtime: cultureType === "게임" ? (combined.playtime || derivedGamePlaytime || null) : combined.playtime,
    occurredAt: log.occurred_at || log.created_at,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
    // 원본 데이터 보존 (엔티티 메타데이터와 로그 페이로드를 합쳐서 관리)
    payload: {
      ...entity.entity_metadata,
      ...log.payload,
      image_url: entity.entity_metadata?.image_url || log.payload?.image_url || cover,
      imageUrl: entity.entity_metadata?.image_url || log.payload?.image_url || cover,
    },
  };
};

/**
 * 하위 호환성을 위한 개별 매퍼 함수들
 */
export const mapReadingLog = (log) => mapLogToUiItem(log);
export const mapStudyLog = (log) => mapLogToUiItem(log);
export const mapCultureLog = (log) => mapLogToUiItem(log);

/**
 * 로그 목록을 날짜별 그룹으로 묶습니다.
 */
export const groupLogsByDate = (logs) => {
  if (!Array.isArray(logs)) return [];
  
  // occurred_at 기준 내림차순 정렬
  const sorted = [...logs].sort((a, b) => {
    const dateA = new Date(a.occurred_at || a.created_at);
    const dateB = new Date(b.occurred_at || b.created_at);
    return dateB - dateA;
  });
  
  return sorted.reduce((acc, log) => {
    const dateSource = log.occurred_at || log.created_at;
    const dateObj = new Date(dateSource);
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
