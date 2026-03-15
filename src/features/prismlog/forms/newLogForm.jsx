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
} from "../core";
import { Badge } from "../ui";
import {
  FORM_LABEL_STYLE,
  getFormInputStyle,
  getSplitFieldStyle,
  getPrimaryActionStyle,
} from "../formStyles";

export const NewLogForm = ({ category, onSubmit, layout, apiBaseUrl, isOpen }) => {
  const colorMap = { reading: COLORS.reading.main, study: COLORS.study.main, culture: COLORS.culture.main };
  const accent = colorMap[category];
  const [readingForm, setReadingForm] = useState(createReadingFormState);
  const [readingStep, setReadingStep] = useState("search");
  const [readingEnrichingPages, setReadingEnrichingPages] = useState(false);
  const [readingSearchComposing, setReadingSearchComposing] = useState(false);
  const [readingDescriptionExpanded, setReadingDescriptionExpanded] = useState(false);
  const [readingPageMessage, setReadingPageMessage] = useState("");
  const [studyForm, setStudyForm] = useState({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "" });
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

  useEffect(() => {
    if (isOpen) return;
    setReadingForm(createReadingFormState());
    setReadingStep("search");
    setReadingEnrichingPages(false);
    setReadingSearchComposing(false);
    setReadingDescriptionExpanded(false);
    setReadingPageMessage("");
    setStudyForm({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "" });
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
      await onSubmit(payload);
      reset();
      setSubmitMessage("저장 완료");
    } catch (error) {
      setSubmitMessage(`저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

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
            <button
              type="button"
              onClick={() => setReadingStep("details")}
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
              Metadata Ready
            </p>
            <h3 style={{ margin: "0 0 6px", fontSize: 22, lineHeight: 1.2, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text }}>
              새 책 추가
            </h3>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: COLORS.dark.textMuted }}>
              책 메타데이터는 이미 채워졌습니다. 매체와 읽기 상태를 정리하면 새 책을 바로 저장할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReadingStep("search")}
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
            다시 검색
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
          <div style={{
            display: "grid",
            gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
            gap: 12,
          }}>
            <div>
              <label style={labelStyle}>{isPercentMode ? "현재 진행률" : "현재 페이지"}</label>
              <input
                value={currentValue}
                onChange={(e) => setReadingForm((prev) => (
                  isPercentMode
                    ? { ...prev, progressValue: e.target.value }
                    : { ...prev, readPages: e.target.value }
                ))}
                style={inputStyle}
                type="number"
                min="0"
                max={isPercentMode ? 100 : undefined}
                placeholder={isPercentMode ? "0~100" : "현재 페이지"}
                disabled={readingForm.readingStatus !== "reading"}
              />
            </div>
            <div>
              <label style={labelStyle}>전체 페이지</label>
              <input
                value={readingForm.pages}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setReadingPageMessage("");
                  setReadingForm((prev) => ({
                    ...prev,
                    pages: nextValue,
                    readPages: prev.readingStatus === "finished" ? nextValue : prev.readPages,
                  }));
                }}
                style={inputStyle}
                type="number"
                placeholder="0"
              />
            </div>
          </div>
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

          {readingForm.readingStatus === "reading" && (
            <div style={{
              marginTop: 16,
              padding: layout?.isPhone ? 14 : 16,
              borderRadius: 18,
              background: `linear-gradient(180deg, ${accent}14, rgba(255,255,255,0.02))`,
              border: `1px solid ${accent}22`,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: COLORS.dark.textMuted }}>
                    {isPercentMode ? "현재 진행률" : "현재 페이지"}
                  </p>
                  <span style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "'Outfit', sans-serif" }}>
                    {isPercentMode ? `${currentValue}%` : `${currentValue}p`}
                  </span>
                </div>
                <div style={{ textAlign: layout?.isPhone ? "left" : "right" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: COLORS.dark.textMuted }}>진행률</p>
                  <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif" }}>
                    {derivedProgress}%
                  </span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max={isPercentMode ? 100 : Math.max(totalPages, 1)}
                step="1"
                value={currentValue}
                onChange={(e) => setReadingForm((prev) => (
                  isPercentMode
                    ? { ...prev, progressValue: e.target.value }
                    : { ...prev, readPages: e.target.value }
                ))}
                style={{ width: "100%", accentColor: accent }}
              />

              <div style={{ display: "grid", gridTemplateColumns: layout?.isPhone ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.dark.border}` }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>{isPercentMode ? "현재 진행률" : "현재 페이지"}</p>
                  <strong style={{ fontSize: 16, color: COLORS.dark.text }}>{isPercentMode ? `${currentValue}%` : `${derivedReadPages}p`}</strong>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.dark.border}` }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>전체 페이지</p>
                  <strong style={{ fontSize: 16, color: COLORS.dark.text }}>{totalPages > 0 ? `${totalPages}p` : "미입력"}</strong>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 14, background: `${accent}18`, border: `1px solid ${accent}30` }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.dark.textMuted }}>진행률</p>
                  <strong style={{ fontSize: 18, color: accent, fontFamily: "'Outfit', sans-serif" }}>{derivedProgress}%</strong>
                </div>
              </div>
            </div>
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
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={labelStyle}>학습 주제</label><input value={studyForm.title} onChange={(e) => setStudyForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="학습 주제를 입력하세요" /></div>
        <div><label style={labelStyle}>자료 첨부 (URL / 텍스트)</label><textarea value={studyForm.resource} onChange={(e) => setStudyForm((prev) => ({ ...prev, resource: e.target.value }))} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="학습 자료 URL 또는 목차를 붙여넣기..." /></div>
        <div><label style={labelStyle}>이미지 URL (선택)</label><input value={studyForm.imageUrl} onChange={(e) => setStudyForm((prev) => ({ ...prev, imageUrl: e.target.value }))} style={inputStyle} placeholder="https://.../study-cover.jpg" /></div>
        <button style={{
          width: "100%", padding: "12px", borderRadius: 12, border: `1.5px dashed ${accent}66`, fontSize: 13, fontWeight: 600,
          background: `${accent}0a`, color: accent, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
        }}>✦ AI로 목차 자동 생성</button>
        <div><label style={labelStyle}>학습 목표</label><input value={studyForm.goal} onChange={(e) => setStudyForm((prev) => ({ ...prev, goal: e.target.value }))} style={inputStyle} placeholder="예: 주 3회, 매일 1시간" /></div>
        <div><label style={labelStyle}>오늘의 회고</label><textarea value={studyForm.retrospect} onChange={(e) => setStudyForm((prev) => ({ ...prev, retrospect: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="오늘 배운 핵심 내용 요약..." /></div>
        <div><label style={labelStyle}>태그</label><input value={studyForm.tags} onChange={(e) => setStudyForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#코딩 #AI ..." /></div>
        {submitMessage && <p style={{ margin: 0, fontSize: 12, color: submitMessage.startsWith("저장 실패") ? "#f8b4bb" : COLORS.study.light }}>{submitMessage}</p>}
        <button
          disabled={submitting}
          onClick={() => {
            const chapters = studyForm.resource.split("\n").map((line) => line.trim()).filter(Boolean);
            handleSave(
              {
                category: "study",
                title: studyForm.title.trim(),
                summary: studyForm.retrospect.trim(),
                tags: parseTags(studyForm.tags),
                payload: {
                  goal: studyForm.goal.trim(),
                  image_url: studyForm.imageUrl.trim() || null,
                  chapters,
                  completed: chapters.map(() => false),
                  progress: 0,
                  hours: 0,
                },
              },
              () => setStudyForm({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "" })
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
          <button
            type="button"
            onClick={() => setCultureStep("details")}
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
      {(
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 12, letterSpacing: 1, color: accent, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
              {cultureForm.sourceId ? "Metadata Ready" : "Manual Input"}
            </p>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: COLORS.dark.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cultureForm.title || "제목 없음"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCultureStep("search")}
            style={{
              padding: "10px 14px", borderRadius: 12, border: `1px solid ${accent}55`,
              background: "rgba(255,255,255,0.04)", color: accent, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Pretendard', sans-serif", flexShrink: 0,
            }}
          >
            다시 검색
          </button>
        </div>
      )}

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
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      border: `1px solid ${active ? theme.borderActive : theme.border}`,
                      background: `linear-gradient(145deg, rgba(18,18,18,0.68), ${theme.surfaceStrong})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 12px 24px ${theme.glow}`,
                      zIndex: 1,
                    }}>
                      <SeriesPlatformIcon platformKey={option.key} size={36} color={theme.accent} />
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
