import { useState, useEffect } from "react";
import BookSearchResultsPanel from "../../../components/BookSearchResultsPanel";
import MediaSearchResultsPanel from "../../../components/MediaSearchResultsPanel";
import {
  COLORS,
  CULTURE_TYPES,
  EBOOK_SERVICES,
  createReadingFormState,
  clearReadingMetadata,
  applyBookSelectionToReadingForm,
  applyBookEnrichmentToReadingForm,
  buildReadingPayload,
  fetchReadingEnrichment,
  getReadingEnrichmentMessage,
  createCultureFormState,
  applyCultureSelectionToForm,
  applyMediaEnrichmentToCultureForm,
  buildCulturePayload,
  clearCultureMetadata,
  fetchMediaEnrichment,
  getCultureStatusOptions,
  getSeriesPlatformLabel,
  getSeriesPlatformTheme,
  getSeriesProgressMetrics,
  SERIES_PLATFORM_OPTIONS,
  SeriesPlatformIcon,
  safeNumber,
  clamp,
  parseTags,
  BookIcon,
  TabletIcon,
  TagIcon,
  ClockIcon,
  CheckIcon,
  PlusIcon,
  ChevronDown,
  DEMO_USER_ID,
} from "../core";
import { Badge, ReadingProgressEditor } from "../ui";
import {
  FORM_LABEL_STYLE,
  getFormInputStyle,
  getSplitFieldStyle,
  getPrimaryActionStyle,
} from "../formStyles";

export const NewLogForm = ({ category, onSubmit, layout, apiBaseUrl, isOpen }) => {
  const colorMap = { reading: COLORS.reading.main, study: COLORS.study.main, culture: COLORS.culture.main };
  const accent = colorMap[category];
  
  // --- 엔티티 시스템 상태 ---
  const [step, setStep] = useState("select-entity"); // select-entity, search, details
  const [entities, setEntities] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const [readingForm, setReadingForm] = useState(createReadingFormState);
  const [readingStep, setReadingStep] = useState("search");
  const [readingEnrichingPages, setReadingEnrichingPages] = useState(false);
  const [readingSearchComposing, setReadingSearchComposing] = useState(false);
  const [readingDescriptionExpanded, setReadingDescriptionExpanded] = useState(false);
  const [readingPageMessage, setReadingPageMessage] = useState("");
  const [studyForm, setStudyForm] = useState({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "", progressMode: "page", pages: "", readPages: "", cover: "", isbn: "" });
  const [studyStep, setStudyStep] = useState("search");
  const [studySearchComposing, setStudySearchComposing] = useState(false);
  const [cultureForm, setCultureForm] = useState(createCultureFormState);
  const [cultureStep, setCultureStep] = useState("search");
  const [cultureSearchComposing, setCultureSearchComposing] = useState(false);
  const [cultureEnriching, setCultureEnriching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const inputStyle = getFormInputStyle();
  const labelStyle = FORM_LABEL_STYLE;
  const actionButtonStyle = getPrimaryActionStyle({
    accent,
    contrastText: category === "study" ? "#1a1816" : "#fff",
    disabled: submitting,
  });
  const splitFieldStyle = getSplitFieldStyle(layout);
  const sectionCardStyle = {
    padding: layout?.isPhone ? "18px 16px" : "24px 22px",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
  };
  const platformCardStyle = (theme, active) => ({
    position: "relative",
    minHeight: layout?.isPhone ? 104 : 118,
    padding: "12px",
    borderRadius: 18,
    border: `1px solid ${active ? theme.borderActive : theme.border}`,
    background: active
      ? `linear-gradient(155deg, ${theme.surfaceStrong}, rgba(255,255,255,0.04))`
      : `linear-gradient(155deg, ${theme.surface}, rgba(255,255,255,0.03))`,
    color: active ? theme.text : COLORS.dark.textMuted,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Pretendard', sans-serif",
    textAlign: "right",
    overflow: "hidden",
    boxShadow: active ? `0 18px 34px ${theme.glow}` : "0 12px 24px rgba(0,0,0,0.16)",
  });

  // 엔티티 목록 가져오기
  useEffect(() => {
    if (!isOpen || step !== "select-entity") return;
    
    const fetchEntities = async () => {
      setLoadingEntities(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/logs/entities?user_id=${DEMO_USER_ID}&category=${category}`);
        if (res.ok) {
          const data = await res.json();
          setEntities(data);
        }
      } catch (err) {
        console.error("failed to fetch entities", err);
      } finally {
        setLoadingEntities(false);
      }
    };
    
    fetchEntities();
  }, [isOpen, category, apiBaseUrl, step]);

  useEffect(() => {
    if (isOpen) return;
    setStep("select-entity");
    setSelectedEntity(null);
    setReadingForm(createReadingFormState());
    setReadingStep("search");
    setReadingEnrichingPages(false);
    setReadingSearchComposing(false);
    setReadingDescriptionExpanded(false);
    setReadingPageMessage("");
    setStudyForm({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "", progressMode: "page", pages: "", readPages: "", cover: "", isbn: "" });
    setStudyStep("search");
    setStudySearchComposing(false);
    setCultureForm(createCultureFormState());
    setCultureStep("search");
    setCultureSearchComposing(false);
    setSubmitMessage("");
    setSubmitting(false);
  }, [isOpen]);

  const handleSave = async (payload, reset) => {
    setSubmitting(true);
    setSubmitMessage("");
    try {
      let entityId = selectedEntity?.id;
      
      // 1. 만약 신규 대상을 추가하는 경우 (검색 등을 통해 직접 입력)
      if (!entityId) {
        const entityPayload = {
          user_id: DEMO_USER_ID,
          category: category,
          title: payload.title,
          source_id: payload.payload.source_id || payload.payload.isbn13 || payload.payload.isbn || null,
          entity_metadata: payload.payload, // 로그 페이로드를 엔티티의 초기 메타데이터로 사용
        };
        
        const entityRes = await fetch(`${apiBaseUrl}/api/v1/logs/entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entityPayload),
        });
        
        if (entityRes.ok) {
          const newEntity = await entityRes.json();
          entityId = newEntity.id;
        } else {
          throw new Error("대상 정보 저장 실패");
        }
      }
      
      // 2. 실제 활동 로그 저장 (entity_id 포함)
      const finalPayload = {
        ...payload,
        entity_id: entityId,
        occurred_at: new Date().toISOString(),
      };
      
      await onSubmit(finalPayload);
      reset();
      setSubmitMessage("저장 완료");
      setTimeout(() => setStep("select-entity"), 1000);
    } catch (error) {
      setSubmitMessage(`저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- 1단계: 엔티티 선택 화면 ---
  if (step === "select-entity") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ padding: "12px 0" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: COLORS.dark.text }}>기록할 대상을 선택하세요</h3>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark.textMuted }}>최근에 기록하던 대상을 이어가거나 새로 추가할 수 있습니다.</p>
        </div>
        
        {loadingEntities ? (
          <p style={{ fontSize: 13, color: COLORS.dark.textMuted }}>목록 불러오는 중...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: layout.isPhone ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
            {/* 새 대상 추가 버튼 */}
            <button
              onClick={() => {
                setSelectedEntity(null);
                setStep("search");
              }}
              style={{
                padding: "20px", borderRadius: 24, border: `2px dashed ${accent}44`,
                background: `${accent}08`, color: accent, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                transition: "all 0.2s",
              }}
            >
              <PlusIcon size={32} />
              <span style={{ fontWeight: 700 }}>새로운 대상 찾기</span>
            </button>
            
            {/* 기존 엔티티 목록 */}
            {entities.map(entity => (
              <button
                key={entity.id}
                onClick={() => {
                  setSelectedEntity(entity);
                  // 엔티티 정보를 폼에 미리 채워넣음
                  if (category === "reading") {
                    setReadingForm(prev => ({ 
                      ...prev, 
                      title: entity.title, 
                      cover: entity.entity_metadata?.cover || "",
                      pages: String(entity.entity_metadata?.pages_total || ""),
                      author: entity.entity_metadata?.author || "",
                      isbn: entity.entity_metadata?.isbn || "",
                      sourceId: entity.entity_metadata?.source_id || "",
                    }));
                    setReadingStep("details");
                  } else if (category === "study") {
                    setStudyForm(prev => ({
                      ...prev,
                      title: entity.title,
                      cover: entity.entity_metadata?.cover || "",
                      pages: String(entity.entity_metadata?.pages_total || ""),
                      isbn: entity.entity_metadata?.isbn || "",
                      progressMode: entity.entity_metadata?.progress_mode || "page",
                      resource: Array.isArray(entity.entity_metadata?.chapters) ? entity.entity_metadata.chapters.join("\n") : "",
                    }));
                    setStudyStep("details");
                  } else {
                    setCultureForm(prev => ({
                      ...prev,
                      title: entity.title,
                      poster: entity.entity_metadata?.poster || "",
                      type: entity.entity_metadata?.type || "영화",
                    }));
                    setCultureStep("details");
                  }
                  setStep("details");
                }}
                style={{
                  padding: "14px", borderRadius: 24, border: `1px solid ${COLORS.dark.border}`,
                  background: "rgba(255,255,255,0.03)", color: COLORS.dark.text, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                }}
              >
                <div style={{ width: 48, height: 68, borderRadius: 8, background: `${accent}22`, overflow: "hidden", flexShrink: 0 }}>
                  {(entity.entity_metadata?.cover || entity.entity_metadata?.poster) && (
                    <img src={entity.entity_metadata.cover || entity.entity_metadata.poster} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entity.title}</h4>
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>{new Date(entity.updated_at).toLocaleDateString()} 업데이트</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (category === "reading") {
    if (readingStep === "search") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            padding: layout?.isPhone ? "18px 16px" : "22px 20px",
            borderRadius: 18,
            border: `1px solid ${accent}22`,
            background: `linear-gradient(180deg, ${accent}18, rgba(255,255,255,0.03))`,
            boxShadow: `0 18px 40px ${accent}14`,
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              Reading Search
            </p>
            <h3 style={{ margin: "0 0 8px", fontSize: layout?.isPhone ? 22 : 24, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
              추가할 책을 먼저 찾으세요
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: COLORS.dark.textMuted }}>
              제목이나 ISBN을 입력하면 아래에 검색 결과가 뜹니다. 원하는 책을 누르면 메타데이터가 채워진 입력 화면으로 이동합니다.
            </p>
          </div>

          <div>
            <label style={labelStyle}>도서명 검색</label>
            <input
              value={readingForm.title}
              onChange={(event) => {
                const nextValue = event.target.value;
                setReadingPageMessage("");
                setReadingForm((prev) => ({ ...clearReadingMetadata(prev), title: nextValue }));
              }}
              onCompositionStart={() => setReadingSearchComposing(true)}
              onCompositionEnd={(event) => {
                setReadingSearchComposing(false);
                const nextValue = event.currentTarget.value;
                setReadingPageMessage("");
                setReadingForm((prev) => ({ ...clearReadingMetadata(prev), title: nextValue }));
              }}
              style={{ ...inputStyle, padding: "15px 18px", fontSize: 16 }}
              placeholder="제목 또는 ISBN으로 검색..."
            />
          </div>

          <BookSearchResultsPanel
            query={readingForm.title}
            apiBaseUrl={apiBaseUrl}
            accentColor={accent}
            suspend={readingSearchComposing}
            onSelect={async (book) => {
                const selectedSourceId = book.source_id;
                setReadingPageMessage("");
                setReadingForm((prev) => applyBookSelectionToReadingForm(prev, book));
                setReadingStep("details");
                setStep("details");
                const isbn = book.isbn13 || book.isbn;
                if (!isbn) {
                  setReadingPageMessage("자동 입력 실패: ISBN이 없어 페이지 정보를 찾을 수 없습니다.");
                  return;
                }
                setReadingEnrichingPages(true);
                try {
                  const enrichment = await fetchReadingEnrichment(apiBaseUrl, isbn);
                  if (!enrichment) return;
                  setReadingForm((prev) => (
                    prev.sourceId === selectedSourceId
                      ? applyBookEnrichmentToReadingForm(prev, enrichment)
                      : prev
                  ));
                  setReadingPageMessage(getReadingEnrichmentMessage(enrichment));
                } catch (error) {
                  console.error("page enrichment failed", error);
                  setReadingPageMessage("자동 입력 실패: 페이지 정보를 불러오는 중 오류가 발생했습니다.");
                } finally {
                  setReadingEnrichingPages(false);
                }
              }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              검색 결과가 없으면 수동 입력으로 계속 진행할 수 있습니다.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setStep("select-entity")} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: COLORS.dark.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>뒤로가기</button>
              <button
                type="button"
                onClick={() => {
                  setReadingStep("details");
                  setStep("details");
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `1px solid ${accent}55`,
                  background: `${accent}16`,
                  color: accent,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Pretendard', sans-serif",
                }}
              >
                직접 입력하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    const isPercentMode = readingForm.medium === "ebook" && readingForm.ebookProgressMode === "percent";
    const totalPages = safeNumber(readingForm.pages);
    const percentValue = clamp(safeNumber(readingForm.progressValue), 0, 100);
    const currentValue = isPercentMode ? percentValue : clamp(safeNumber(readingForm.readPages), 0, Math.max(totalPages, safeNumber(readingForm.readPages)));
    const derivedReadPages = isPercentMode
      ? (totalPages > 0 ? Math.round((percentValue / 100) * totalPages) : 0)
      : currentValue;
    const derivedProgress = isPercentMode
      ? percentValue
      : totalPages > 0 ? clamp(Math.round((derivedReadPages / totalPages) * 100), 0, 100) : 0;
    const mediaOptions = [
      { key: "paper", label: "종이책", Icon: BookIcon },
      { key: "ebook", label: "전자책", Icon: TabletIcon },
      { key: "rental", label: "대여", Icon: TagIcon },
    ];
    const statusOptions = [
      { key: "reading", label: "읽는 중", Icon: BookIcon, color: accent, description: "현재 읽은 지점을 바로 기록" },
      { key: "planned", label: "읽을 예정", Icon: ClockIcon, color: "#f0c75e", description: "시작 전 상태로 보관" },
      { key: "finished", label: "완독", Icon: CheckIcon, color: "#63d2a4", description: "진행률 100%로 저장" },
    ];
    const sectionCardStyle = {
      padding: layout?.isPhone ? "16px" : "18px",
      borderRadius: 20,
      border: `1px solid ${accent}20`,
      background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(12,12,12,0.06))",
      boxShadow: "0 20px 40px rgba(0,0,0,0.16)",
    };
    const chipButtonStyle = (active) => ({
      minHeight: 46,
      padding: "12px 14px",
      borderRadius: 16,
      border: `1px solid ${active ? `${accent}88` : COLORS.dark.border}`,
      background: active ? `linear-gradient(135deg, ${accent}24, ${accent}12)` : "rgba(255,255,255,0.03)",
      color: active ? COLORS.dark.text : COLORS.dark.textMuted,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "'Pretendard', sans-serif",
      transition: "all 0.22s ease",
    });
    const handleReadingStatusChange = (status) => {
      setReadingForm((prev) => {
        if (status === "planned") {
          return { ...prev, readingStatus: status, readPages: "0", progressValue: "0" };
        }
        if (status === "finished") {
          const nextPages = safeNumber(prev.pages);
          return {
            ...prev,
            readingStatus: status,
            readPages: nextPages > 0 ? String(nextPages) : prev.readPages,
            progressValue: "100",
          };
        }
        return { ...prev, readingStatus: status };
      });
    };
    const handleReadingPageAutofill = async () => {
      const isbn = readingForm.isbn;
      if (!isbn) {
        setReadingPageMessage("자동 입력 실패: ISBN을 먼저 입력해 주세요.");
        return;
      }
      const activeSourceId = readingForm.sourceId || "";
      setReadingPageMessage("");
      setReadingEnrichingPages(true);
      try {
        const enrichment = await fetchReadingEnrichment(apiBaseUrl, isbn);
        if (!enrichment) return;
        setReadingForm((prev) => (
          prev.sourceId === activeSourceId
            ? applyBookEnrichmentToReadingForm(prev, enrichment)
            : prev
        ));
        setReadingPageMessage(getReadingEnrichmentMessage(enrichment));
      } catch (error) {
        console.error("manual page enrichment failed", error);
        setReadingPageMessage("자동 입력 실패: 페이지 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setReadingEnrichingPages(false);
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{
          display: "flex",
          alignItems: layout?.isPhone ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
          flexDirection: layout?.isPhone ? "column" : "row",
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              {selectedEntity ? "Continuing History" : "New Discovery"}
            </p>
            <h3 style={{ margin: "0 0 6px", fontSize: 22, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
              {selectedEntity ? "기록 이어가기" : "새 책 추가"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setStep("select-entity")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${accent}55`,
              background: "rgba(255,255,255,0.04)",
              color: accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Pretendard', sans-serif",
              flexShrink: 0,
            }}
          >
            대상 변경
          </button>
        </div>
        <div style={{
          ...sectionCardStyle,
          display: "grid",
          gridTemplateColumns: layout?.isTabletUp ? "132px minmax(0, 1fr)" : "1fr",
          gap: 18,
          alignItems: layout?.isTabletUp ? "center" : "stretch",
          background: `linear-gradient(145deg, ${accent}14, rgba(255,255,255,0.03))`,
        }}>
          <div style={{
            width: layout?.isTabletUp ? 132 : "min(56vw, 220px)",
            aspectRatio: "3 / 4.4",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 28px 50px rgba(0,0,0,0.26)",
            border: `1px solid ${accent}22`,
            background: `${accent}16`,
            justifySelf: layout?.isTabletUp ? "stretch" : "center",
          }}>
            {readingForm.cover ? (
              <img src={readingForm.cover} alt={`${readingForm.title || "도서"} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookIcon size={32} color={accent} />
              </div>
            )}
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: accent, fontFamily: "'Outfit', sans-serif" }}>
              {readingForm.sourceProvider ? "BOOK SELECTED" : "MANUAL ENTRY"}
            </span>
            <h3 style={{ margin: 0, fontSize: layout?.isPhone ? 24 : 28, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
              {readingForm.title || "제목을 입력해 주세요"}
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: COLORS.dark.textMuted }}>
              {readingForm.author || "작가 정보 없음"}
            </p>
            {readingForm.description && (
              <div style={{
                marginTop: 4,
                padding: "12px 14px",
                borderRadius: 16,
                background: `${accent}10`,
                border: `1px solid ${accent}20`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: accent, fontFamily: "'Outfit', sans-serif" }}>
                    책 소개
                  </p>
                  <button
                    type="button"
                    onClick={() => setReadingDescriptionExpanded((prev) => !prev)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${accent}44`,
                      background: "rgba(255,255,255,0.03)",
                      color: accent,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Pretendard', sans-serif",
                    }}
                  >
                    {readingDescriptionExpanded ? "접기" : "펼쳐보기"}
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: COLORS.dark.textMuted,
                    display: readingDescriptionExpanded ? "block" : "-webkit-box",
                    WebkitLineClamp: readingDescriptionExpanded ? "unset" : 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {readingForm.description}
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {readingForm.publisher && <Badge text={readingForm.publisher} color={accent} />}
              {readingForm.publishedDate && <Badge text={readingForm.publishedDate} color={accent} />}
              {readingEnrichingPages && <Badge text="페이지 보강 중" color={accent} />}
            </div>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <label style={labelStyle}>매체 유형</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {mediaOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setReadingForm((prev) => ({
                  ...prev,
                  medium: option.key,
                  ebookService: option.key === "ebook" ? prev.ebookService : "",
                  ebookProgressMode: option.key === "ebook" ? prev.ebookProgressMode : "page",
                }))}
                style={{
                  ...chipButtonStyle(readingForm.medium === option.key),
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 92,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  padding: layout?.isPhone ? "14px 12px" : "16px 14px",
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 8,
                  right: 6,
                  opacity: readingForm.medium === option.key ? 0.22 : 0.14,
                  pointerEvents: "none",
                  transform: "scale(1.15)",
                }}>
                  <option.Icon size={layout?.isPhone ? 42 : 50} color="rgba(255,255,255,0.96)" />
                </span>
                <span style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ fontSize: layout?.isPhone ? 13 : 14, fontWeight: 800, color: readingForm.medium === option.key ? COLORS.dark.text : COLORS.dark.textMuted }}>
                    {option.label}
                  </strong>
                  <span style={{ fontSize: 11, lineHeight: 1.5, color: readingForm.medium === option.key ? COLORS.dark.textMuted : "rgba(244,239,235,0.62)" }}>
                    {option.key === "paper" ? "실물 책 기준" : option.key === "ebook" ? "페이지/퍼센트 선택" : "대여본 기록"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {readingForm.medium === "ebook" && (
            <div style={{
              marginTop: 14,
              padding: layout?.isPhone ? 14 : 16,
              borderRadius: 18,
              border: `1px solid ${accent}24`,
              background: `linear-gradient(180deg, ${accent}12, rgba(255,255,255,0.02))`,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 4 }}>전자책 서비스</label>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: COLORS.dark.textMuted }}>
                  로고는 추후 수집해 붙일 예정입니다. 지금은 서비스 종류만 먼저 선택할 수 있게 둡니다.
                </p>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: layout?.isDesktop ? "repeat(5, minmax(0, 1fr))" : layout?.isTabletUp ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}>
                {EBOOK_SERVICES.map((service) => {
                  const active = readingForm.ebookService === service.key;
                  return (
                    <button
                      key={service.key}
                      type="button"
                      onClick={() => setReadingForm((prev) => ({ ...prev, ebookService: service.key }))}
                      style={{
                        minHeight: 74,
                        padding: "12px 10px",
                        borderRadius: 16,
                        border: `1px solid ${active ? `${accent}88` : COLORS.dark.border}`,
                        background: active ? `linear-gradient(135deg, ${accent}20, ${accent}10)` : "rgba(255,255,255,0.03)",
                        color: active ? COLORS.dark.text : COLORS.dark.textMuted,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 10,
                        textAlign: "left",
                        fontFamily: "'Pretendard', sans-serif",
                      }}
                    >
                      <span style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: active ? `${accent}20` : "rgba(255,255,255,0.06)",
                        border: `1px solid ${active ? `${accent}44` : COLORS.dark.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        color: active ? accent : COLORS.dark.textMuted,
                        fontFamily: "'Outfit', sans-serif",
                      }}>
                        {service.label.slice(0, 1)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{service.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>페이지 정보</label>
              <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
                {readingForm.medium === "paper" ? "종이책은 가능하면 자동으로 전체 페이지를 채웁니다." : readingForm.medium === "ebook" ? "전자책은 페이지 또는 퍼센트 기준으로 진행률을 다룰 수 있습니다." : "대여 도서는 전체 페이지를 직접 수정해 둘 수 있습니다."}
              </p>
            </div>
            {readingForm.medium === "ebook" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "page", label: "페이지 기준" },
                  { key: "percent", label: "퍼센트 기준" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setReadingForm((prev) => ({ ...prev, ebookProgressMode: option.key }))}
                    style={chipButtonStyle(readingForm.ebookProgressMode === option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>읽기 상태</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {statusOptions.map((option) => {
                const active = readingForm.readingStatus === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleReadingStatusChange(option.key)}
                    style={{
                      minHeight: 92,
                      padding: layout?.isPhone ? "14px 12px" : "16px 14px",
                      borderRadius: 16,
                      border: `1px solid ${active ? `${option.color}88` : COLORS.dark.border}`,
                      background: active ? `linear-gradient(135deg, ${option.color}24, ${option.color}12)` : "rgba(255,255,255,0.03)",
                      color: active ? COLORS.dark.text : COLORS.dark.textMuted,
                      cursor: "pointer",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontFamily: "'Pretendard', sans-serif",
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      top: 8,
                      right: 6,
                      opacity: active ? 0.26 : 0.14,
                      pointerEvents: "none",
                      transform: "scale(1.15)",
                    }}>
                      <option.Icon size={layout?.isPhone ? 40 : 48} color="rgba(255,255,255,0.96)" />
                    </span>
                    <span style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong style={{ fontSize: layout?.isPhone ? 13 : 14, fontWeight: 800, color: active ? COLORS.dark.text : COLORS.dark.textMuted }}>
                        {option.label}
                      </strong>
                      <span style={{ fontSize: 11, lineHeight: 1.5, color: active ? COLORS.dark.textMuted : "rgba(244,239,235,0.62)" }}>
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              ISBN이 있으면 전체 페이지와 추가 메타데이터를 다시 보강할 수 있습니다.
            </p>
            <button
              type="button"
              disabled={!readingForm.isbn || readingEnrichingPages}
              onClick={handleReadingPageAutofill}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: `1px solid ${readingForm.isbn ? `${accent}55` : COLORS.dark.border}`,
                background: readingForm.isbn ? `${accent}16` : "rgba(255,255,255,0.03)",
                color: readingForm.isbn ? accent : COLORS.dark.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: !readingForm.isbn || readingEnrichingPages ? "not-allowed" : "pointer",
                fontFamily: "'Pretendard', sans-serif",
                opacity: readingEnrichingPages ? 0.72 : 1,
              }}
            >
              {readingEnrichingPages ? "자동 입력 중..." : "전체 페이지 자동 입력"}
            </button>
          </div>
          <ReadingProgressEditor
            layout={layout}
            accent={accent}
            isPercentMode={isPercentMode}
            currentValue={currentValue}
            totalPages={readingForm.pages}
            derivedProgress={derivedProgress}
            derivedReadPages={derivedReadPages}
            disabled={readingForm.readingStatus !== "reading"}
            onCurrentChange={(value) => setReadingForm((prev) => (
              isPercentMode
                ? { ...prev, progressValue: value.replace(/\D/g, "") }
                : { ...prev, readPages: value.replace(/\D/g, "") }
            ))}
            onTotalChange={(value) => {
              const nextValue = value.replace(/\D/g, "");
              setReadingPageMessage("");
              setReadingForm((prev) => ({
                ...prev,
                pages: nextValue,
                readPages: prev.readingStatus === "finished" ? nextValue : prev.readPages,
              }));
            }}
          />
          {readingPageMessage && (
            <p style={{
              margin: "10px 0 0",
              fontSize: 12,
              lineHeight: 1.6,
              color: readingPageMessage.startsWith("자동 입력 실패") ? "#f8b4bb" : COLORS.reading.light,
            }}>
              {readingPageMessage}
            </p>
          )}

          {readingForm.readingStatus !== "reading" && (
            <div style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 16,
              border: `1px solid ${accent}18`,
              background: "rgba(255,255,255,0.03)",
              fontSize: 13,
              color: COLORS.dark.textMuted,
              lineHeight: 1.6,
            }}>
              {readingForm.readingStatus === "planned"
                ? "전체 페이지를 확인해 두면 읽기 시작할 때 진행률 계산이 바로 됩니다."
                : "완독 상태로 저장됩니다. 전체 페이지가 있으면 현재 페이지는 마지막 장으로 맞춰집니다."}
            </div>
          )}
        </div>

        <div style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 4 }}>기타 메타데이터</label>
              <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
                출간일, 출판사, ISBN, 표지 URL 등 필요한 메타데이터를 수정할 수 있습니다.
              </p>
            </div>
          </div>

          <div style={splitFieldStyle}>
            <div><label style={labelStyle}>작가</label><input value={readingForm.author} onChange={(e) => setReadingForm((prev) => ({ ...prev, author: e.target.value }))} style={inputStyle} placeholder="저자명" /></div>
            <div><label style={labelStyle}>출판사</label><input value={readingForm.publisher} onChange={(e) => setReadingForm((prev) => ({ ...prev, publisher: e.target.value }))} style={inputStyle} placeholder="출판사" /></div>
          </div>
          <div style={splitFieldStyle}>
            <div><label style={labelStyle}>출간일</label><input value={readingForm.publishedDate} onChange={(e) => setReadingForm((prev) => ({ ...prev, publishedDate: e.target.value }))} style={inputStyle} placeholder="YYYY-MM-DD" /></div>
            <div><label style={labelStyle}>ISBN</label><input value={readingForm.isbn} onChange={(e) => setReadingForm((prev) => ({ ...prev, isbn: e.target.value }))} style={inputStyle} placeholder="978..." /></div>
          </div>
          <div><label style={labelStyle}>표지 이미지 URL</label><input value={readingForm.cover} onChange={(e) => setReadingForm((prev) => ({ ...prev, cover: e.target.value }))} style={inputStyle} placeholder="https://.../cover.jpg" /></div>
        </div>

        <div style={sectionCardStyle}>
          <label style={labelStyle}>책 메모</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea value={readingForm.memo} onChange={(e) => setReadingForm((prev) => ({ ...prev, memo: e.target.value }))} style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="기억하고 싶은 문장이나 생각..." />
            <div style={splitFieldStyle}>
              <div><label style={labelStyle}>평점</label><input value={readingForm.rating} onChange={(e) => setReadingForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" /></div>
              <div><label style={labelStyle}>한 줄 평</label><input value={readingForm.review} onChange={(e) => setReadingForm((prev) => ({ ...prev, review: e.target.value }))} style={inputStyle} placeholder="이 책을 한 마디로..." /></div>
            </div>
            <div><label style={labelStyle}>태그</label><input value={readingForm.tags} onChange={(e) => setReadingForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#자기계발 #소설 ..." /></div>
          </div>
        </div>
        {submitMessage && <p style={{ margin: 0, fontSize: 12, color: submitMessage.startsWith("저장 실패") ? "#f8b4bb" : COLORS.reading.light }}>{submitMessage}</p>}
        <button
          disabled={submitting}
          onClick={() => handleSave(
            {
              category: "reading",
              title: readingForm.title.trim(),
              summary: readingForm.memo.trim(),
              tags: parseTags(readingForm.tags),
              payload: buildReadingPayload(readingForm),
            },
            () => {
              setReadingForm(createReadingFormState());
              setReadingStep("search");
            }
          )}
          style={actionButtonStyle}
        >
          {submitting ? "저장 중..." : "새 책 저장하기"}
        </button>
      </div>
    );
  }
  if (category === "study") {
    if (studyStep === "search") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            padding: layout?.isPhone ? "18px 16px" : "22px 20px",
            borderRadius: 18,
            border: `1px solid ${accent}22`,
            background: `linear-gradient(180deg, ${accent}18, rgba(255,255,255,0.03))`,
            boxShadow: `0 18px 40px ${accent}14`,
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              Study Search
            </p>
            <h3 style={{ margin: "0 0 8px", fontSize: layout?.isPhone ? 22 : 24, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
              공부할 교재를 찾으세요
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: COLORS.dark.textMuted }}>
              교재 제목이나 ISBN을 입력하면 아래에 검색 결과가 나타납니다. 검색 결과에서 선택하면 페이지 정보가 자동으로 채워집니다.
            </p>
          </div>

          <div>
            <label style={labelStyle}>교재 검색</label>
            <input
              value={studyForm.title}
              onChange={(e) => {
                const val = e.target.value;
                setStudyForm(prev => ({ ...prev, title: val, cover: "", isbn: "", pages: "" }));
              }}
              onCompositionStart={() => setStudySearchComposing(true)}
              onCompositionEnd={() => setStudySearchComposing(false)}
              style={{ ...inputStyle, padding: "15px 18px", fontSize: 16 }}
              placeholder="교재 제목 또는 ISBN..."
            />
          </div>

          <BookSearchResultsPanel
            query={studyForm.title}
            apiBaseUrl={apiBaseUrl}
            accentColor={accent}
            suspend={studySearchComposing}
            onSelect={async (book) => {
              setStudyForm(prev => ({
                ...prev,
                title: book.title || prev.title,
                pages: book.pages_total ? String(book.pages_total) : prev.pages,
                cover: book.cover_url || "",
                isbn: book.isbn13 || book.isbn || "",
              }));
              setStudyStep("details");
              setStep("details");
              
              const isbn = book.isbn13 || book.isbn;
              if (isbn) {
                try {
                  const enrichment = await fetchReadingEnrichment(apiBaseUrl, isbn);
                  if (enrichment?.pages_total) {
                    setStudyForm(prev => ({ ...prev, pages: String(enrichment.pages_total) }));
                  }
                } catch (error) {
                  console.error("study page enrichment failed", error);
                }
              }
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
              검색 결과가 없으면 직접 입력으로 계속할 수 있습니다.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setStep("select-entity")} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: COLORS.dark.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>뒤로가기</button>
              <button
                type="button"
                onClick={() => {
                  setStudyStep("details");
                  setStep("details");
                }}
                style={{
                  padding: "10px 14px", borderRadius: 12, border: `1px solid ${accent}55`,
                  background: `${accent}16`, color: accent, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
                }}
              >
                직접 입력하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{
          display: "flex",
          alignItems: layout?.isPhone ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
          flexDirection: layout?.isPhone ? "column" : "row",
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              {selectedEntity ? "Continuing History" : "New Discovery"}
            </p>
            <h3 style={{ margin: "0 0 6px", fontSize: 22, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
              {selectedEntity ? "기록 이어가기" : "공부 기록 상세"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setStep("select-entity")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${accent}55`,
              background: "rgba(255,255,255,0.04)",
              color: accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Pretendard', sans-serif",
              flexShrink: 0,
            }}
          >
            대상 변경
          </button>
        </div>

        <div style={{
          ...sectionCardStyle,
          display: "grid",
          gridTemplateColumns: layout?.isTabletUp ? "132px minmax(0, 1fr)" : "1fr",
          gap: 18,
          alignItems: layout?.isTabletUp ? "center" : "stretch",
          background: `linear-gradient(145deg, ${accent}14, rgba(255,255,255,0.03))`,
        }}>
          <div style={{
            width: layout?.isTabletUp ? 132 : "min(56vw, 220px)",
            aspectRatio: "3 / 4.4",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 28px 50px rgba(0,0,0,0.26)",
            border: `1px solid ${accent}22`,
            background: `${accent}16`,
            justifySelf: layout?.isTabletUp ? "stretch" : "center",
          }}>
            {studyForm.cover ? (
              <img src={studyForm.cover} alt={`${studyForm.title || "교재"} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookIcon size={32} color={accent} />
              </div>
            )}
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: accent, fontFamily: "'Outfit', sans-serif" }}>
              {studyForm.isbn ? "TEXTBOOK SELECTED" : "MANUAL ENTRY"}
            </span>
            <h3 style={{ margin: 0, fontSize: layout?.isPhone ? 24 : 28, lineHeight: 1.15, fontWeight: 800, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
              {studyForm.title || "제목을 입력해 주세요"}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {studyForm.isbn && <Badge text={`ISBN: ${studyForm.isbn}`} color={accent} />}
              {studyForm.pages && <Badge text={`${studyForm.pages} 페이지`} color={accent} />}
            </div>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>진행 방식</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { key: "page", label: "페이지 기준" },
                  { key: "chapter", label: "목차(챕터) 기준" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStudyForm(prev => ({ ...prev, progressMode: option.key }))}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 12,
                      border: `1px solid ${studyForm.progressMode === option.key ? accent : COLORS.dark.border}`,
                      background: studyForm.progressMode === option.key ? `${accent}16` : "rgba(255,255,255,0.04)",
                      color: studyForm.progressMode === option.key ? accent : COLORS.dark.textMuted,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {studyForm.progressMode === "page" ? (
              <div style={splitFieldStyle}>
                <div><label style={labelStyle}>진행 페이지</label><input style={inputStyle} type="number" value={studyForm.readPages} onChange={(e) => setStudyForm(prev => ({ ...prev, readPages: e.target.value }))} placeholder="0" /></div>
                <div><label style={labelStyle}>전체 페이지</label><input style={inputStyle} type="number" value={studyForm.pages} onChange={(e) => setStudyForm(prev => ({ ...prev, pages: e.target.value }))} placeholder="0" /></div>
              </div>
            ) : (
              <div>
                <label style={labelStyle}>목차 입력 (줄바꿈으로 구분)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 120 }}
                  placeholder="예:&#10;1장. 서론&#10;2장. 기본 문법"
                  value={studyForm.resource}
                  onChange={(e) => setStudyForm(prev => ({ ...prev, resource: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>

        <div style={sectionCardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={labelStyle}>학습 목표</label><input value={studyForm.goal} onChange={(e) => setStudyForm((prev) => ({ ...prev, goal: e.target.value }))} style={inputStyle} placeholder="예: 주 3회, 매일 1시간" /></div>
            <div><label style={labelStyle}>오늘의 회고</label><textarea value={studyForm.retrospect} onChange={(e) => setStudyForm((prev) => ({ ...prev, retrospect: e.target.value }))} style={{ ...inputStyle, minHeight: 100 }} placeholder="오늘 배운 핵심 내용 요약..." /></div>
            <div><label style={labelStyle}>태그</label><input value={studyForm.tags} onChange={(e) => setStudyForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#코딩 #AI ..." /></div>
          </div>
        </div>

        {submitMessage && <p style={{ margin: 0, fontSize: 12, color: submitMessage.startsWith("저장 실패") ? "#f8b4bb" : accent }}>{submitMessage}</p>}
        
        <button
          disabled={submitting}
          onClick={() => {
            const chapters = studyForm.progressMode === "chapter" 
              ? studyForm.resource.split("\n").map((line) => line.trim()).filter(Boolean)
              : [];
            
            handleSave(
              {
                category: "study",
                title: studyForm.title.trim(),
                summary: studyForm.retrospect.trim(),
                tags: parseTags(studyForm.tags),
                payload: {
                  goal: studyForm.goal.trim(),
                  cover: studyForm.cover || null,
                  isbn: studyForm.isbn || null,
                  progress_mode: studyForm.progressMode,
                  pages_read: studyForm.readPages || null,
                  pages_total: studyForm.pages || null,
                  chapters,
                  completed: chapters.map(() => false),
                },
              },
              () => {
                setStudyForm({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "", pages: "", readPages: "", progressMode: "page", cover: "", isbn: "" });
                setStudyStep("search");
              }
            );
          }}
          style={actionButtonStyle}
        >
          {submitting ? "저장 중..." : "기록 저장하기"}
        </button>
      </div>
    );
  }
  // culture — step: search
  const isGameType = cultureForm.type === "게임";
  if (cultureStep === "search") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{
          padding: layout?.isPhone ? "18px 16px" : "22px 20px",
          borderRadius: 18,
          border: `1px solid ${accent}22`,
          background: `linear-gradient(180deg, ${accent}18, rgba(255,255,255,0.03))`,
          boxShadow: `0 18px 40px ${accent}14`,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
            Content Search
          </p>
          <h3 style={{ margin: "0 0 8px", fontSize: layout?.isPhone ? 22 : 24, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
            {isGameType ? "추가할 게임을 찾으세요" : "추가할 콘텐츠를 찾으세요"}
          </h3>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: COLORS.dark.textMuted }}>
            {isGameType ? "게임 제목을 입력하면 커버 이미지와 출시일이 자동으로 채워집니다." : "제목을 입력하면 포스터·개봉일·줄거리가 자동으로 채워집니다."}
          </p>
        </div>

        <div>
          <label style={labelStyle}>유형</label>
          <div style={{ display: "flex", gap: 8 }}>
            {CULTURE_TYPES.map(t => (
              <button key={t} onClick={() => setCultureForm((prev) => ({ ...prev, type: t, status: getCultureStatusOptions(t)[0] }))} style={{
                padding: "8px 16px", borderRadius: 10, border: `1px solid ${cultureForm.type === t ? accent : COLORS.dark.border}`,
                background: cultureForm.type === t ? `${accent}18` : "rgba(255,255,255,0.04)", color: cultureForm.type === t ? accent : COLORS.dark.textMuted, fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>콘텐츠 검색</label>
          <input
            value={cultureForm.title}
            onChange={(e) => {
              const nextValue = e.target.value;
              setCultureForm((prev) => ({ ...clearCultureMetadata(prev), title: nextValue }));
            }}
            onCompositionStart={() => setCultureSearchComposing(true)}
            onCompositionEnd={() => setCultureSearchComposing(false)}
            style={{ ...inputStyle, padding: "15px 18px", fontSize: 16 }}
            placeholder={cultureForm.type === "게임" ? "게임 제목으로 검색..." : cultureForm.type === "시리즈" ? "시리즈 제목으로 검색..." : "영화 제목으로 검색..."}
            disabled={cultureSearchComposing}
          />
        </div>

        <MediaSearchResultsPanel
          query={cultureForm.title}
          mediaType={cultureForm.type}
          apiBaseUrl={apiBaseUrl}
          accentColor={accent}
          suspend={cultureSearchComposing}
          onSelect={async (media) => {
            const selectedSourceId = media.source_id;
            setCultureForm((prev) => applyCultureSelectionToForm(prev, media));
            setCultureStep("details");
            setStep("details");
            const tmdbId = media.tmdb_id;
            const type = media.type;
            if (!tmdbId || !["movie", "series"].includes(type)) return;
            setCultureEnriching(true);
            try {
              const enrich = await fetchMediaEnrichment(apiBaseUrl, tmdbId, type);
              if (!enrich) return;
              setCultureForm((prev) => {
                if (prev.sourceId !== selectedSourceId) return prev;
                return applyMediaEnrichmentToCultureForm(prev, enrich);
              });
            } catch (err) {
              console.error("media enrich failed", err);
            } finally {
              setCultureEnriching(false);
            }
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>
            검색 결과가 없으면 직접 입력으로 계속할 수 있습니다.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setStep("select-entity")} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: COLORS.dark.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>뒤로가기</button>
            <button
              type="button"
              onClick={() => {
                setCultureStep("details");
                setStep("details");
              }}
              style={{
                padding: "10px 14px", borderRadius: 12, border: `1px solid ${accent}55`,
                background: `${accent}16`, color: accent, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
              }}
            >
              직접 입력하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // culture — step: details (또는 게임)
  const seriesMetrics = cultureForm.type === "시리즈"
    ? getSeriesProgressMetrics({
      episodeCount: cultureForm.episodeCount,
      seasons: cultureForm.seasons,
      watchedEpisodes: cultureForm.watchedEpisodes,
      playtime: cultureForm.playtime,
    })
    : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        display: "flex",
        alignItems: layout?.isPhone ? "stretch" : "center",
        justifyContent: "space-between",
        gap: 12,
        flexDirection: layout?.isPhone ? "column" : "row",
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
            {selectedEntity ? "Continuing History" : "New Discovery"}
          </p>
          <h3 style={{ margin: "0 0 6px", fontSize: 22, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
            {selectedEntity ? "기록 이어가기" : "새 콘텐츠 추가"}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setStep("select-entity")}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1px solid ${accent}55`,
            background: "rgba(255,255,255,0.04)",
            color: accent,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Pretendard', sans-serif",
            flexShrink: 0,
          }}
        >
          대상 변경
        </button>
      </div>

      {cultureForm.poster && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <img
            src={cultureForm.poster}
            alt="포스터"
            style={{ width: 72, height: 104, borderRadius: 8, objectFit: "cover", flexShrink: 0, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          />
          <div style={{ minWidth: 0 }}>
            {(cultureForm.releaseDate || cultureForm.episodeCount || cultureForm.runtime || cultureEnriching) && (
              <p style={{ margin: "0 0 4px", fontSize: 12, color: COLORS.dark.textMuted }}>
                {[
                  cultureForm.releaseDate && `${cultureForm.releaseDate.slice(0, 4)}년`,
                  cultureEnriching ? "정보 불러오는 중..." :
                    cultureForm.episodeCount ? `총 ${cultureForm.episodeCount}화${cultureForm.seasonCount > 1 ? ` · ${cultureForm.seasonCount}시즌` : ""}` :
                    cultureForm.runtime ? `${cultureForm.runtime}분` : null,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
            {cultureForm.overview && (
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: COLORS.dark.textMuted, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {cultureForm.overview}
              </p>
            )}
          </div>
        </div>
      )}

      <div><label style={labelStyle}>{isGameType ? "게임 제목" : "제목"}</label>
        <input value={cultureForm.title} onChange={(e) => setCultureForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder={isGameType ? "게임 제목을 입력하세요" : "영화 또는 시리즈 제목"} />
      </div>

      <div><label style={labelStyle}>유형</label>
        <div style={{ display: "flex", gap: 8 }}>
          {CULTURE_TYPES.map(t => (
            <button key={t} onClick={() => setCultureForm((prev) => ({ ...prev, type: t, status: getCultureStatusOptions(t)[0] }))} style={{
              padding: "8px 16px", borderRadius: 10, border: `1px solid ${cultureForm.type === t ? accent : COLORS.dark.border}`,
              background: cultureForm.type === t ? `${accent}18` : "rgba(255,255,255,0.04)", color: cultureForm.type === t ? accent : COLORS.dark.textMuted, fontSize: 13,
              fontWeight: 600, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div><label style={labelStyle}>상태</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {getCultureStatusOptions(cultureForm.type).map(s => (
            <button key={s} onClick={() => setCultureForm((prev) => ({ ...prev, status: s }))} style={{
              padding: "8px 14px", borderRadius: 10, border: `1px solid ${cultureForm.status === s ? accent : COLORS.dark.border}`,
              background: cultureForm.status === s ? `${accent}18` : "rgba(255,255,255,0.04)", color: cultureForm.status === s ? accent : COLORS.dark.textMuted, fontSize: 12,
              fontWeight: 600, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
            }}>{s}</button>
          ))}
        </div>
      </div>

      {cultureForm.type === "시리즈" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>시청 플랫폼</label>
            <div style={{ display: "grid", gridTemplateColumns: layout?.isPhone ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {SERIES_PLATFORM_OPTIONS.map((option) => {
                const active = cultureForm.platformKey === option.key;
                const theme = getSeriesPlatformTheme(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                  onClick={() => setCultureForm((prev) => ({
                      ...prev,
                      platformKey: option.key,
                      platformLabel: option.key === "other" ? prev.platformLabel : getSeriesPlatformLabel(option.key),
                    }))}
                    style={platformCardStyle(theme, active)}
                  >
                    <div style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1,
                    }}>
                      <SeriesPlatformIcon platformKey={option.key} size={54} color={theme.accent} />
                    </div>
                    <span style={{ position: "relative", zIndex: 1 }}>{option.label}</span>
                  </button>
                );
              })}
          </div>
          {cultureForm.platformKey === "other" && (
            <input
              value={cultureForm.platformLabel}
              onChange={(e) => setCultureForm((prev) => ({ ...prev, platformLabel: e.target.value }))}
              style={inputStyle}
              placeholder="예: 왓챠"
            />
          )}
        </div>
      )}

      {cultureForm.type === "시리즈" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={splitFieldStyle}>
            <div>
              <label style={labelStyle}>시청한 회차 수</label>
              <input
                value={cultureForm.watchedEpisodes}
                onChange={(e) => setCultureForm((prev) => ({ ...prev, watchedEpisodes: e.target.value }))}
                style={inputStyle}
                type="number"
                min="0"
                max={cultureForm.episodeCount || undefined}
                placeholder="0"
              />
            </div>
            <div>
              <label style={labelStyle}>평점</label>
              <input value={cultureForm.rating} onChange={(e) => setCultureForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" />
            </div>
          </div>
          <div style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: `1px solid ${accent}22`,
            background: `${accent}12`,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>
              {seriesMetrics?.playtimeLabel || "회차 정보를 입력하면 진행률이 계산됩니다."}
            </span>
            <strong style={{ fontSize: 12, color: accent }}>
              {seriesMetrics ? `${seriesMetrics.progress}% 진행` : "0% 진행"}
            </strong>
          </div>
        </div>
      ) : (
        <div style={splitFieldStyle}>
          <div>
            <label style={labelStyle}>{isGameType ? "플레이타임" : "시청 메모"}</label>
            <input value={cultureForm.playtime} onChange={(e) => setCultureForm((prev) => ({ ...prev, playtime: e.target.value }))} style={inputStyle} placeholder={isGameType ? "예: 42시간" : "예: 극장 관람"} />
          </div>
          <div>
            <label style={labelStyle}>평점</label>
            <input value={cultureForm.rating} onChange={(e) => setCultureForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" />
          </div>
        </div>
      )}

      <div><label style={labelStyle}>태그</label>
        <input value={cultureForm.tags} onChange={(e) => setCultureForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#SF #드라마 ..." />
      </div>

      {submitMessage && <p style={{ margin: 0, fontSize: 12, color: submitMessage.startsWith("저장 실패") ? "#f8b4bb" : COLORS.culture.light }}>{submitMessage}</p>}

      <button
        disabled={submitting}
        onClick={() => handleSave(
          {
            category: "culture",
            title: cultureForm.title.trim(),
            summary: cultureForm.overview.trim(),
            tags: parseTags(cultureForm.tags),
            payload: buildCulturePayload(cultureForm),
          },
          () => {
            setCultureForm(createCultureFormState());
            setCultureStep("search");
          }
        )}
        style={actionButtonStyle}
      >
        {submitting ? "저장 중..." : "기록 저장하기"}
      </button>
    </div>
  );
};
