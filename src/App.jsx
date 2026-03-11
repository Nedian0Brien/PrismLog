import { Suspense, lazy, useState, useEffect, useCallback, useMemo } from "react";
import BookAutocompleteField from "./components/BookAutocompleteField";
import BookSearchResultsPanel from "./components/BookSearchResultsPanel";
import {
  API_BASE_URL,
  DEMO_USER_ID,
  COLORS,
  CATEGORY_KEYS,
  CATEGORY_META,
  NAV_TAB_COLORS,
  CULTURE_TYPES,
  EBOOK_SERVICES,
  useResponsiveLayout,
  getResponsiveColumns,
  clamp,
  safeNumber,
  createReadingFormState,
  clearReadingMetadata,
  applyBookSelectionToReadingForm,
  applyPageEnrichmentToReadingForm,
  buildReadingPayload,
  fetchReadingPageCount,
  normalizeCultureType,
  getCultureStatusOptions,
  formatKoreanDateLabel,
  formatMonthDayLabel,
  formatTimeLabel,
  getDateKey,
  formatRelativeTime,
  mapReadingLog,
  mapStudyLog,
  mapCultureLog,
  buildHeatmapMatrix,
  buildTrendSeries,
  parseTags,
  getCultureTone,
  BookIcon,
  PenIcon,
  FilmIcon,
  PlusIcon,
  CalendarIcon,
  TagIcon,
  ChevronDown,
  StarIcon,
  XIcon,
  HomeIcon,
  BarChartIcon,
  CheckIcon,
  ListIcon,
  TabletIcon,
  GridIcon,
  ClockIcon,
  SettingsIcon,
  GamepadIcon,
} from "./features/prismlog/core";
import {
  HalfDonutChart,
  GlassCard,
  ProgressBar,
  IconActionButton,
  Badge,
  StatusBadge,
  RatingStars,
  SpectrumRing,
  Heatmap,
  CategoryToggleChips,
  TrendLineChart,
  DistributionBarChart,
  BottomSheet,
  CategorySelector,
} from "./features/prismlog/ui";

const MobileFloatingNav = lazy(() => import("./components/MobileFloatingNav"));

const NewLogForm = ({ category, onSubmit, layout, apiBaseUrl, isOpen }) => {
  const colorMap = { reading: COLORS.reading.main, study: COLORS.study.main, culture: COLORS.culture.main };
  const accent = colorMap[category];
  const [readingForm, setReadingForm] = useState(createReadingFormState);
  const [readingStep, setReadingStep] = useState("search");
  const [readingEnrichingPages, setReadingEnrichingPages] = useState(false);
  const [readingSearchComposing, setReadingSearchComposing] = useState(false);
  const [readingDescriptionExpanded, setReadingDescriptionExpanded] = useState(false);
  const [readingPageMessage, setReadingPageMessage] = useState("");
  const [studyForm, setStudyForm] = useState({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "" });
  const [cultureForm, setCultureForm] = useState({ title: "", type: "영화", status: "시청 중", rating: 0, playtime: "", tags: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.dark.border}`,
    color: COLORS.dark.text, outline: "none", fontFamily: "'Pretendard', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: COLORS.dark.textMuted, marginBottom: 6, display: "block" };
  const actionButtonStyle = {
    width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: category === "study" ? "#1a1816" : "#fff", cursor: submitting ? "not-allowed" : "pointer",
    boxShadow: `0 4px 20px ${accent}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif", opacity: submitting ? 0.7 : 1,
  };
  const splitFieldStyle = {
    display: "grid",
    gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: 12,
  };

  useEffect(() => {
    if (isOpen) return;
    setReadingForm(createReadingFormState());
    setReadingStep("search");
    setReadingEnrichingPages(false);
    setReadingSearchComposing(false);
    setReadingDescriptionExpanded(false);
    setReadingPageMessage("");
    setStudyForm({ title: "", resource: "", goal: "", imageUrl: "", retrospect: "", tags: "" });
    setCultureForm({ title: "", type: "영화", status: "시청 중", rating: 0, playtime: "", tags: "" });
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
              style={{ ...inputStyle, padding: "15px 18px", fontSize: 15 }}
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
                  const pages = await fetchReadingPageCount(apiBaseUrl, isbn);
                  if (!pages) {
                    setReadingPageMessage("자동 입력 실패: 해당 ISBN으로 페이지 정보를 찾지 못했습니다.");
                    return;
                  }
                  setReadingForm((prev) => (
                    prev.sourceId === selectedSourceId
                      ? applyPageEnrichmentToReadingForm(prev, pages)
                      : prev
                  ));
                  setReadingPageMessage(`전체 페이지를 자동으로 불러왔습니다. (${pages}p)`);
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
        const pages = await fetchReadingPageCount(apiBaseUrl, isbn);
        if (!pages) {
          setReadingPageMessage("자동 입력 실패: 해당 ISBN으로 페이지 정보를 찾지 못했습니다.");
          return;
        }
        setReadingForm((prev) => (
          prev.sourceId === activeSourceId
            ? applyPageEnrichmentToReadingForm(prev, pages)
            : prev
        ));
        setReadingPageMessage(`전체 페이지를 자동으로 불러왔습니다. (${pages}p)`);
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
              ISBN이 있으면 버튼으로 전체 페이지를 다시 불러올 수 있습니다.
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
  // culture
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><label style={labelStyle}>콘텐츠 검색</label><input value={cultureForm.title} onChange={(e) => setCultureForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} placeholder="영화, 시리즈, 게임 제목 검색..." /></div>
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
      <div><label style={labelStyle}>플레이타임 / 회차</label><input value={cultureForm.playtime} onChange={(e) => setCultureForm((prev) => ({ ...prev, playtime: e.target.value }))} style={inputStyle} placeholder="예: 8화 / 10화, 42시간" /></div>
      <div><label style={labelStyle}>평점</label><input value={cultureForm.rating} onChange={(e) => setCultureForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" /></div>
      <div><label style={labelStyle}>태그</label><input value={cultureForm.tags} onChange={(e) => setCultureForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#SF #드라마 ..." /></div>
      {submitMessage && <p style={{ margin: 0, fontSize: 12, color: submitMessage.startsWith("저장 실패") ? "#f8b4bb" : COLORS.culture.light }}>{submitMessage}</p>}
      <button
        disabled={submitting}
        onClick={() => handleSave(
          {
            category: "culture",
            title: cultureForm.title.trim(),
            summary: "",
            tags: parseTags(cultureForm.tags),
            payload: {
              type: cultureForm.type,
              status: cultureForm.status,
              playtime: cultureForm.playtime.trim() || null,
              rating: clamp(safeNumber(cultureForm.rating), 0, 5),
            },
          },
          () => setCultureForm({ title: "", type: "영화", status: "시청 중", rating: 0, playtime: "", tags: "" })
        )}
        style={actionButtonStyle}
      >
        {submitting ? "저장 중..." : "기록 저장하기"}
      </button>
    </div>
  );
};

const ReadingEditSheet = ({ open, record, onClose, onSave, onDelete, layout, apiBaseUrl }) => {
  const [form, setForm] = useState(createReadingFormState);
  const [pageEnriching, setPageEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!record) return;
    setForm({
      title: record.title || "",
      author: record.author || "",
      publisher: record.publisher || "",
      isbn: record.isbn || "",
      publishedDate: record.publishedDate || "",
      description: record.description || "",
      cover: record.cover || "",
      medium: record.medium || "paper",
      ebookService: record.ebookService || "",
      ebookProgressMode: record.ebookProgressMode || "page",
      readingStatus: record.readingStatus || "reading",
      readPages: String(record.readPages || 0),
      pages: String(record.pages || 0),
      progressValue: String(record.progressValue ?? record.progress ?? 0),
      memo: record.summary || "",
      review: record.review || "",
      rating: safeNumber(record.rating),
      tags: (record.tags || []).map((tag) => `#${tag}`).join(" "),
      sourceProvider: record.sourceProvider || "",
      sourceId: record.sourceId || "",
    });
    setPageEnriching(false);
    setMessage("");
  }, [record]);

  if (!record) return null;

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.dark.border}`,
    color: COLORS.dark.text, outline: "none", fontFamily: "'Pretendard', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: COLORS.dark.textMuted, marginBottom: 6, display: "block" };
  const splitFieldStyle = {
    display: "grid",
    gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: 12,
  };

  const save = async () => {
    if (!form.title.trim()) {
      setMessage("제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await onSave(record.id, {
        title: form.title.trim(),
        summary: form.memo.trim(),
        tags: parseTags(form.tags),
        payload: buildReadingPayload(form),
      });
      setMessage("저장 완료");
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    setDeleting(true);
    setMessage("");
    try {
      await onDelete(record.id);
      setDeleting(false);
      onClose();
    } catch (error) {
      setMessage(`삭제 실패: ${error instanceof Error ? error.message : "unknown error"}`);
      setDeleting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="독서 기록 수정" layout={layout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>도서명</label>
          <BookAutocompleteField
            value={form.title}
            onChange={(nextValue) => setForm((prev) => {
              if (prev.sourceId && nextValue.trim() !== prev.title.trim()) {
                return { ...clearReadingMetadata(prev), title: nextValue };
              }
              return { ...prev, title: nextValue };
            })}
            onSelect={async (book) => {
              const selectedSourceId = book.source_id;
              setForm((prev) => applyBookSelectionToReadingForm(prev, book));
              const isbn = book.isbn13 || book.isbn;
              if (!isbn) return;
              setPageEnriching(true);
              try {
                const pages = await fetchReadingPageCount(apiBaseUrl, isbn);
                if (!pages) return;
                setForm((prev) => (
                  prev.sourceId === selectedSourceId
                    ? applyPageEnrichmentToReadingForm(prev, pages)
                    : prev
                ));
              } catch (error) {
                console.error("page enrichment failed", error);
              } finally {
                setPageEnriching(false);
              }
            }}
            apiBaseUrl={apiBaseUrl}
            inputStyle={inputStyle}
            accentColor={COLORS.reading.main}
          />
        </div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>저자</label><input value={form.author} onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>출판사</label><input value={form.publisher} onChange={(e) => setForm((prev) => ({ ...prev, publisher: e.target.value }))} style={inputStyle} /></div>
        </div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>ISBN</label><input value={form.isbn} onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))} style={inputStyle} placeholder="978..." /></div>
          <div><label style={labelStyle}>출간일</label><input value={form.publishedDate} onChange={(e) => setForm((prev) => ({ ...prev, publishedDate: e.target.value }))} style={inputStyle} placeholder="YYYY-MM-DD" /></div>
        </div>
        <div><label style={labelStyle}>표지 이미지 URL</label><input value={form.cover} onChange={(e) => setForm((prev) => ({ ...prev, cover: e.target.value }))} style={inputStyle} placeholder="https://.../cover.jpg" /></div>
        {(form.cover || form.sourceProvider || form.description) && (
          <div style={{
            display: "flex",
            gap: 12,
            padding: 12,
            borderRadius: 14,
            border: `1px solid ${COLORS.reading.main}22`,
            background: `${COLORS.reading.main}12`,
            alignItems: "flex-start",
          }}>
            <div style={{
              width: 56,
              height: 78,
              borderRadius: 10,
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
            }}>
              {form.cover ? (
                <img src={form.cover} alt={`${form.title || "도서"} 표지`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <BookIcon size={18} color={COLORS.reading.main} />
              )}
            </div>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.reading.main }}>
                {form.sourceProvider ? `${form.sourceProvider.toUpperCase()} 자동 입력` : "수동 입력"}
              </span>
              <span style={{ fontSize: 12, color: COLORS.dark.textMuted }}>
                {[form.author, form.publisher, form.publishedDate].filter(Boolean).join(" · ") || "메타데이터를 직접 수정할 수 있습니다."}
              </span>
              {form.description && (
                <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted, lineHeight: 1.5 }}>
                  {form.description}
                </p>
              )}
              {pageEnriching && (
                <p style={{ margin: 0, fontSize: 11, color: COLORS.reading.main }}>
                  Google Books에서 페이지 정보를 보강하는 중...
                </p>
              )}
            </div>
          </div>
        )}
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>읽은 페이지</label><input value={form.readPages} onChange={(e) => setForm((prev) => ({ ...prev, readPages: e.target.value }))} style={inputStyle} type="number" /></div>
          <div><label style={labelStyle}>전체 페이지</label><input value={form.pages} onChange={(e) => setForm((prev) => ({ ...prev, pages: e.target.value }))} style={inputStyle} type="number" /></div>
        </div>
        <div><label style={labelStyle}>메모 / 필사</label><textarea value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} /></div>
        <div><label style={labelStyle}>한 줄 평</label><input value={form.review} onChange={(e) => setForm((prev) => ({ ...prev, review: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>평점</label><input value={form.rating} onChange={(e) => setForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" /></div>
        <div><label style={labelStyle}>태그</label><input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#자기계발 #소설" /></div>
        {message && <p style={{ margin: 0, fontSize: 12, color: message.startsWith("저장 실패") ? "#f8b4bb" : COLORS.reading.light }}>{message}</p>}
        <button
          onClick={save}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.reading.main}, ${COLORS.reading.main}cc)`, color: "#fff", cursor: saving || deleting ? "not-allowed" : "pointer",
            boxShadow: `0 4px 20px ${COLORS.reading.main}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button
          onClick={remove}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(230,57,70,0.5)",
            fontSize: 14, fontWeight: 700, background: "rgba(230,57,70,0.14)", color: "#f8b4bb",
            cursor: saving || deleting ? "not-allowed" : "pointer", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

const StudyEditSheet = ({ open, record, onClose, onSave, onDelete, layout }) => {
  const [form, setForm] = useState({
    title: "",
    goal: "",
    imageUrl: "",
    retrospect: "",
    chaptersText: "",
    tags: "",
    progress: 0,
    hours: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!record) return;
    setForm({
      title: record.title || "",
      goal: record.goal || "",
      imageUrl: record.imageUrl || "",
      retrospect: record.summary || "",
      chaptersText: (record.chapters || []).join("\n"),
      tags: (record.tags || []).map((tag) => `#${tag}`).join(" "),
      progress: safeNumber(record.progress),
      hours: safeNumber(record.hours),
    });
    setMessage("");
  }, [record]);

  if (!record) return null;

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.dark.border}`,
    color: COLORS.dark.text, outline: "none", fontFamily: "'Pretendard', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: COLORS.dark.textMuted, marginBottom: 6, display: "block" };
  const splitFieldStyle = {
    display: "grid",
    gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: 12,
  };

  const save = async () => {
    if (!form.title.trim()) {
      setMessage("제목을 입력해 주세요.");
      return;
    }
    const chapters = form.chaptersText.split("\n").map((line) => line.trim()).filter(Boolean);
    const baseCompleted = Array.isArray(record.completed) ? record.completed : [];
    const completed = chapters.map((_, idx) => Boolean(baseCompleted[idx]));

    setSaving(true);
    setMessage("");
    try {
      await onSave(record.id, {
        title: form.title.trim(),
        summary: form.retrospect.trim(),
        tags: parseTags(form.tags),
        payload: {
          goal: form.goal.trim(),
          image_url: form.imageUrl.trim() || null,
          chapters,
          completed,
          progress: clamp(safeNumber(form.progress), 0, 100),
          hours: Math.max(0, safeNumber(form.hours)),
        },
      });
      setMessage("저장 완료");
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    setDeleting(true);
    setMessage("");
    try {
      await onDelete(record.id);
      setDeleting(false);
      onClose();
    } catch (error) {
      setMessage(`삭제 실패: ${error instanceof Error ? error.message : "unknown error"}`);
      setDeleting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="공부 기록 수정" layout={layout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={labelStyle}>학습 주제</label><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>학습 목표</label><input value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>이미지 URL</label><input value={form.imageUrl} onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))} style={inputStyle} placeholder="https://.../study-cover.jpg" /></div>
        <div><label style={labelStyle}>학습 목차 (줄바꿈 구분)</label><textarea value={form.chaptersText} onChange={(e) => setForm((prev) => ({ ...prev, chaptersText: e.target.value }))} style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} /></div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>진척도(%)</label><input value={form.progress} onChange={(e) => setForm((prev) => ({ ...prev, progress: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="100" /></div>
          <div><label style={labelStyle}>학습 시간(h)</label><input value={form.hours} onChange={(e) => setForm((prev) => ({ ...prev, hours: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" /></div>
        </div>
        <div><label style={labelStyle}>회고</label><textarea value={form.retrospect} onChange={(e) => setForm((prev) => ({ ...prev, retrospect: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} /></div>
        <div><label style={labelStyle}>태그</label><input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#코딩 #AI" /></div>
        {message && <p style={{ margin: 0, fontSize: 12, color: message.startsWith("저장 실패") ? "#f8b4bb" : COLORS.study.light }}>{message}</p>}
        <button
          onClick={save}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.study.main}, ${COLORS.study.main}cc)`, color: "#1a1816", cursor: saving || deleting ? "not-allowed" : "pointer",
            boxShadow: `0 4px 20px ${COLORS.study.main}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button
          onClick={remove}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(230,57,70,0.5)",
            fontSize: 14, fontWeight: 700, background: "rgba(230,57,70,0.14)", color: "#f8b4bb",
            cursor: saving || deleting ? "not-allowed" : "pointer", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

const CultureEditSheet = ({ open, record, onClose, onSave, onDelete, layout }) => {
  const [form, setForm] = useState({
    title: "",
    summary: "",
    type: "영화",
    status: "시청 중",
    playtime: "",
    rating: 0,
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!record) return;
    setForm({
      title: record.title || "",
      summary: record.summary || "",
      type: normalizeCultureType(record.type),
      status: record.status || (normalizeCultureType(record.type) === "게임" ? "플레이 중" : "시청 중"),
      playtime: record.playtime || "",
      rating: safeNumber(record.rating),
      tags: (record.tags || []).map((tag) => `#${tag}`).join(" "),
    });
    setMessage("");
  }, [record]);

  if (!record) return null;

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.dark.border}`,
    color: COLORS.dark.text, outline: "none", fontFamily: "'Pretendard', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: COLORS.dark.textMuted, marginBottom: 6, display: "block" };
  const splitFieldStyle = {
    display: "grid",
    gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
    gap: 12,
  };

  const save = async () => {
    if (!form.title.trim()) {
      setMessage("제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await onSave(record.id, {
        title: form.title.trim(),
        summary: form.summary.trim(),
        tags: parseTags(form.tags),
        payload: {
          type: form.type,
          status: form.status,
          playtime: form.playtime.trim() || null,
          rating: clamp(safeNumber(form.rating), 0, 5),
        },
      });
      setMessage("저장 완료");
    } catch (error) {
      setMessage(`저장 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    setDeleting(true);
    setMessage("");
    try {
      await onDelete(record.id);
      setDeleting(false);
      onClose();
    } catch (error) {
      setMessage(`삭제 실패: ${error instanceof Error ? error.message : "unknown error"}`);
      setDeleting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="문화 기록 수정" layout={layout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={labelStyle}>콘텐츠 제목</label><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>메모</label><textarea value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} /></div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>유형</label><select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value, status: getCultureStatusOptions(e.target.value)[0] }))} style={inputStyle}>{CULTURE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div><label style={labelStyle}>상태</label><select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>{getCultureStatusOptions(form.type).map((status) => <option key={status}>{status}</option>)}</select></div>
        </div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>플레이타임 / 회차</label><input value={form.playtime} onChange={(e) => setForm((prev) => ({ ...prev, playtime: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>평점</label><input value={form.rating} onChange={(e) => setForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" /></div>
        </div>
        <div><label style={labelStyle}>태그</label><input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#SF #드라마" /></div>
        {message && <p style={{ margin: 0, fontSize: 12, color: message.startsWith("저장 실패") ? "#f8b4bb" : COLORS.culture.light }}>{message}</p>}
        <button
          onClick={save}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
            background: `linear-gradient(135deg, ${COLORS.culture.main}, ${COLORS.culture.main}cc)`, color: "#fff", cursor: saving || deleting ? "not-allowed" : "pointer",
            boxShadow: `0 4px 20px ${COLORS.culture.main}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button
          onClick={remove}
          disabled={saving || deleting}
          style={{
            width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(230,57,70,0.5)",
            fontSize: 14, fontWeight: 700, background: "rgba(230,57,70,0.14)", color: "#f8b4bb",
            cursor: saving || deleting ? "not-allowed" : "pointer", fontFamily: "'Pretendard', sans-serif", opacity: saving || deleting ? 0.7 : 1,
          }}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

/* ──────────── Study Detail (Accordion) ──────────── */
const StudyAccordion = ({ study }) => {
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
              {study.completed[i] ? "✓ 이 챕터의 학습을 완료했습니다." : "아직 학습하지 않은 챕터입니다. 시작해볼까요?"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ──────────── Page: Dashboard ──────────── */
const DashboardPage = ({ logs, stats, recentLogs, todayLabel, ringValues, loading, error, layout }) => {
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
const ReadingGridCard = ({ book, onEdit, onAdd, layout }) => {
  const chartSize = layout.isDesktop ? 188 : layout.isTablet ? 176 : 164;
  return (
    <GlassCard
      glow={COLORS.reading.glow}
      style={{
        padding: "12px 12px 12px",
        minHeight: layout.isPhone ? 320 : 350,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
        textAlign: "center",
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
        onClick={() => onAdd(book)}
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
        onClick={() => onEdit(book)}
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
const ReadingPage = ({ books, loading, onEdit, onAdd, layout }) => {
  const [viewMode, setViewMode] = useState("list");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
          <span style={{ color: COLORS.reading.main }}>📚</span> 독서 기록
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
              <GlassCard glow={COLORS.reading.glow} style={{ padding: "18px 20px" }}>
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
                      <IconActionButton onClick={() => onEdit(book)} />
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
                <ReadingGridCard book={book} onEdit={onEdit} onAdd={onAdd} layout={layout} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ──────────── Page: Study ──────────── */
const StudyPage = ({ studies, loading, onEdit, layout }) => {
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
        <span style={{ color: COLORS.study.main }}>📝</span> 공부 기록
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
const CulturePage = ({ items, loading, onEdit, layout, title = "문화생활", fixedType = null }) => {
  const [filter, setFilter] = useState(fixedType || "전체");
  const filters = ["전체", ...CULTURE_TYPES];

  useEffect(() => {
    if (fixedType) setFilter(fixedType);
  }, [fixedType]);

  const filtered = useMemo(() => {
    if (fixedType) return items.filter((item) => item.type === fixedType);
    return filter === "전체" ? items : items.filter((item) => item.type === filter);
  }, [filter, fixedType, items]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <span style={{ color: COLORS.culture.main }}>🎬</span> {title}
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
          return (
          <GlassCard key={c.id} glow={glow} style={{ padding: 0, overflow: "hidden" }}>
            {/* poster placeholder */}
            <div style={{
              height: 160, background: c.poster ? COLORS.dark.surfaceSolid : `linear-gradient(160deg, ${accent}25, ${COLORS.dark.surfaceSolid})`,
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              {c.poster ? (
                <img src={c.poster} alt={`${c.title} 포스터`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : c.type === "게임" ? (
                <GamepadIcon size={36} color={`${accent}88`} />
              ) : (
                <FilmIcon size={36} color={`${accent}88`} />
              )}
              <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={c.status} /></div>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 4px", fontFamily: "'Pretendard', sans-serif", flex: 1 }}>{c.title}</h4>
                <IconActionButton onClick={() => onEdit(c)} />
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
          </GlassCard>
        )})}
      </div>
    </div>
  );
};

const RecordAreaCard = ({ section, onSelect, layout, columns = 2 }) => {
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

const RecordsPage = ({ readingLogs, studyLogs, cultureLogs, loading, onEditReading, onEditStudy, onEditCulture, onAddReading, layout }) => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [mobileColumns, setMobileColumns] = useState(1);

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
      key: "reading",
      label: "독서",
      description: "표지와 진행률",
      count: sortedReading.length,
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
      key: "study",
      label: "공부",
      description: "진척률과 챕터",
      count: sortedStudy.length,
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
      key: "movie",
      label: "영화",
      description: "포스터와 평점",
      count: movieLogs.length,
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
      key: "series",
      label: "시리즈",
      description: "회차와 상태",
      count: seriesLogs.length,
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
      key: "game",
      label: "게임",
      description: "플레이 시간",
      count: gameLogs.length,
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
  ]), [gameLogs, movieLogs, seriesLogs, sortedReading, sortedStudy]);

  const activeSection = sections.find((section) => section.key === selectedSection) || null;
  const mobileColumnOptions = [
    { value: 1, label: "1열", icon: <ListIcon size={16} /> },
    { value: 2, label: "2열", icon: <GridIcon size={16} /> },
  ];

  const renderSectionPage = () => {
    switch (selectedSection) {
      case "reading":
        return <ReadingPage books={sortedReading} loading={loading} onEdit={onEditReading} onAdd={onAddReading} layout={layout} />;
      case "study":
        return <StudyPage studies={sortedStudy} loading={loading} onEdit={onEditStudy} layout={layout} />;
      case "movie":
        return <CulturePage items={movieLogs} loading={loading} onEdit={onEditCulture} layout={layout} title="영화 기록" fixedType="영화" />;
      case "series":
        return <CulturePage items={seriesLogs} loading={loading} onEdit={onEditCulture} layout={layout} title="시리즈 기록" fixedType="시리즈" />;
      case "game":
        return <CulturePage items={gameLogs} loading={loading} onEdit={onEditCulture} layout={layout} title="게임 기록" fixedType="게임" />;
      default:
        return null;
    }
  };

  if (selectedSection) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedSection(null)}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
            <RecordAreaCard section={section} onSelect={setSelectedSection} layout={layout} columns={recordHubColumns} />
          </div>
        ))}
      </div>
    </div>
  );
};

const TimelinePage = ({ logs, loading, layout }) => {
  const [view, setView] = useState("feed");

  const groups = useMemo(() => {
    const sorted = [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.reduce((acc, log) => {
      const key = getDateKey(log.created_at);
      if (!key) return acc;
      const payload = log.payload || {};
      const type = log.category === "culture" ? normalizeCultureType(payload.type) : log.category;
      const accent = log.category === "reading"
        ? COLORS.reading.main
        : log.category === "study"
          ? COLORS.study.main
          : getCultureTone(type).main;
      const item = {
        id: log.id,
        title: log.title,
        time: formatTimeLabel(log.created_at),
        accent,
        categoryLabel: log.category === "reading" ? "독서" : log.category === "study" ? "공부" : type,
        summary: log.summary || (log.category === "reading"
          ? `${safeNumber(payload.pages_read)} / ${safeNumber(payload.pages_total)}p`
          : log.category === "study"
            ? `${Array.isArray(payload.chapters) ? payload.chapters.length : 0}개 챕터`
            : payload.playtime || payload.status || ""),
        status: log.category === "culture" ? (payload.status || (type === "게임" ? "플레이 중" : "시청 중")) : "",
      };
      const existing = acc.find((group) => group.key === key);
      if (existing) {
        existing.items.push(item);
      } else {
        const date = new Date(log.created_at);
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

  const calendarMonths = useMemo(() => {
    const counts = logs.reduce((acc, log) => {
      const key = getDateKey(log.created_at);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const uniqueMonthKeys = [...new Set(logs.map((log) => {
      const date = new Date(log.created_at);
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
  const lineLeft = layout.isPhone ? 17 : 118;

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
          <div style={{ position: "relative", paddingLeft: layout.isPhone ? 0 : 8 }}>
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
                    left: layout.isPhone ? 11 : lineLeft - 7,
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          borderRadius: 22,
                          border: `1px solid ${item.accent}2c`,
                          background: `linear-gradient(180deg, rgba(255,255,255,0.03), ${item.accent}10)`,
                          padding: layout.isPhone ? "16px" : "18px 20px",
                          boxShadow: "0 18px 34px rgba(0,0,0,0.14)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Badge text={item.categoryLabel} color={item.accent} />
                            {item.status ? <StatusBadge status={item.status} /> : null}
                          </div>
                          <span style={{ fontSize: 12, color: COLORS.dark.textMuted, fontFamily: "'Outfit', sans-serif" }}>{item.time}</span>
                        </div>
                        <h3 style={{ margin: "0 0 8px", fontSize: 19, lineHeight: 1.35, fontWeight: 800, fontFamily: "'Pretendard', sans-serif" }}>{item.title}</h3>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: COLORS.dark.textMuted }}>{item.summary || "기록 메모 없음"}</p>
                      </div>
                    ))}
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

const SettingsPage = ({ readingLogs, studyLogs, cultureLogs, layout }) => {
  const cultureBreakdown = useMemo(() => ({
    movie: cultureLogs.filter((item) => item.type === "영화").length,
    series: cultureLogs.filter((item) => item.type === "시리즈").length,
    game: cultureLogs.filter((item) => item.type === "게임").length,
  }), [cultureLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, color: COLORS.dark.textMuted, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>Settings</p>
        <h2 style={{ margin: 0, fontSize: layout.isPhone ? 24 : 30, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>설정</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: layout.isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 14 }}>
        <GlassCard>
          <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>기록 구성</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.dark.textMuted }}>독서</span><strong style={{ color: COLORS.reading.main }}>{readingLogs.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.dark.textMuted }}>공부</span><strong style={{ color: COLORS.study.main }}>{studyLogs.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.dark.textMuted }}>영화</span><strong style={{ color: COLORS.movie.main }}>{cultureBreakdown.movie}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.dark.textMuted }}>시리즈</span><strong style={{ color: COLORS.series.main }}>{cultureBreakdown.series}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.dark.textMuted }}>게임</span><strong style={{ color: COLORS.game.main }}>{cultureBreakdown.game}</strong></div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>탐색 구조</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "전역 탭", value: "홈 / 기록 / 타임라인 / 설정" },
              { label: "기록 필터", value: "전체 / 독서 / 공부 / 영화 / 시리즈 / 게임" },
              { label: "타임라인 뷰", value: "시간순 피드 / 캘린더" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.dark.border}` }}>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: COLORS.dark.textMuted }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 14, color: COLORS.dark.text }}>{item.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

/* ──────────── Main App ──────────── */
export default function PrismLog() {
  const [page, setPage] = useState("home");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newLogCat, setNewLogCat] = useState("reading");
  const [glowEffect, setGlowEffect] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingReading, setEditingReading] = useState(null);
  const [editingStudy, setEditingStudy] = useState(null);
  const [editingCulture, setEditingCulture] = useState(null);
  const layout = useResponsiveLayout();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/logs?user_id=${encodeURIComponent(DEMO_USER_ID)}&limit=200`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "unknown error");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const readingLogs = useMemo(
    () => logs.filter((log) => log.category === "reading").map(mapReadingLog),
    [logs]
  );
  const studyLogs = useMemo(
    () => logs.filter((log) => log.category === "study").map(mapStudyLog),
    [logs]
  );
  const cultureLogs = useMemo(
    () => logs.filter((log) => log.category === "culture").map(mapCultureLog),
    [logs]
  );

  const ringValues = useMemo(() => ({
    reading: readingLogs.length,
    study: studyLogs.length,
    culture: cultureLogs.length,
  }), [readingLogs.length, studyLogs.length, cultureLogs.length]);

  const stats = useMemo(() => {
    const studyHours = studyLogs.reduce((sum, item) => sum + item.hours, 0);
    return [
      { label: "독서", value: `${readingLogs.length}권`, sub: "누적", color: COLORS.reading.main, icon: <BookIcon size={18} color={COLORS.reading.main} /> },
      { label: "공부", value: `${studyHours}h`, sub: "누적", color: COLORS.study.main, icon: <PenIcon size={18} color={COLORS.study.main} /> },
      { label: "문화", value: `${cultureLogs.length}편`, sub: "누적", color: COLORS.culture.main, icon: <FilmIcon size={18} color={COLORS.culture.main} /> },
    ];
  }, [readingLogs.length, studyLogs, cultureLogs.length]);

  const recentLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4)
      .map((log) => {
        const payload = log.payload || {};
        const color = log.category === "reading" ? COLORS.reading.main : log.category === "study" ? COLORS.study.main : COLORS.culture.main;
        let title = log.title;
        if (log.category === "reading") {
          title = `${log.title} · ${safeNumber(payload.progress)}% 읽음`;
        } else if (log.category === "study") {
          const completed = Array.isArray(payload.completed) ? payload.completed.filter(Boolean).length : 0;
          title = `${log.title} · ${completed}개 챕터 완료`;
        } else if (log.category === "culture") {
          title = `${log.title} · ${normalizeCultureType(payload.type)} · ${payload.status || "상태 미설정"}`;
        }
        return { title, color, time: formatRelativeTime(log.created_at) };
      });
  }, [logs]);

  const todayLabel = useMemo(() => formatKoreanDateLabel(new Date().toISOString()), []);

  const saveLog = useCallback(async (logInput) => {
    const title = (logInput.title || "").trim();
    if (!title) throw new Error("제목을 입력해 주세요");
    const categoryColor = logInput.category === "reading"
      ? COLORS.reading.main
      : logInput.category === "study"
        ? COLORS.study.main
        : COLORS.culture.main;

    const response = await fetch(`${API_BASE_URL}/api/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: DEMO_USER_ID,
        category: logInput.category,
        title,
        summary: logInput.summary || "",
        tags: Array.isArray(logInput.tags) ? logInput.tags : [],
        payload: logInput.payload || {},
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    await fetchLogs();
    setSheetOpen(false);
    setGlowEffect(categoryColor);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [fetchLogs]);

  const updateLog = useCallback(async (logId, patch) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    await fetchLogs();
  }, [fetchLogs]);

  const deleteLog = useCallback(async (logId) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) throw new Error(`HTTP ${response.status}`);
    await fetchLogs();
  }, [fetchLogs]);

  const deleteFromEdit = useCallback(async (logId) => {
    await deleteLog(logId);
    setGlowEffect(COLORS.culture.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [deleteLog]);

  const openReadingEdit = useCallback((book) => {
    setEditingReading(book);
  }, []);

  const addReadingProgress = useCallback(async (book) => {
    const addedRaw = window.prompt("이번에 추가로 읽은 페이지 수를 입력하세요", "10");
    if (addedRaw === null) return;
    const addedPages = Number(addedRaw);
    if (!Number.isFinite(addedPages) || addedPages <= 0) {
      window.alert("1 이상의 숫자를 입력해 주세요.");
      return;
    }

    const currentRead = Math.max(0, safeNumber(book.readPages));
    const currentTotal = Math.max(0, safeNumber(book.pages));
    const nextRead = currentRead + Math.round(addedPages);
    const nextTotal = currentTotal > 0 ? currentTotal : nextRead;
    const boundedRead = clamp(nextRead, 0, Math.max(nextTotal, 1));
    const nextProgress = nextTotal > 0 ? clamp(Math.round((boundedRead / nextTotal) * 100), 0, 100) : 0;

    try {
      await updateLog(book.id, {
        payload: {
          author: book.author || "",
          publisher: book.publisher || null,
          isbn: book.isbn || null,
          isbn13: extractIsbn13(book.isbn) || null,
          published_date: book.publishedDate || null,
          description: book.description || null,
          cover: book.cover || null,
          source_provider: book.sourceProvider || null,
          source_id: book.sourceId || null,
          pages_read: boundedRead,
          pages_total: nextTotal,
          progress: nextProgress,
          rating: clamp(safeNumber(book.rating), 0, 5),
          review: book.review || "",
        },
      });
      setGlowEffect(COLORS.reading.main);
      setTimeout(() => setGlowEffect(null), 1200);
    } catch (error) {
      window.alert(`기록 추가 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, [updateLog]);

  const saveReadingEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingReading(null);
    setGlowEffect(COLORS.reading.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const openStudyEdit = useCallback((study) => {
    setEditingStudy(study);
  }, []);

  const saveStudyEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingStudy(null);
    setGlowEffect(COLORS.study.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const openCultureEdit = useCallback((item) => {
    setEditingCulture(item);
  }, []);

  const saveCultureEdit = useCallback(async (logId, patch) => {
    await updateLog(logId, patch);
    setEditingCulture(null);
    setGlowEffect(COLORS.culture.main);
    setTimeout(() => setGlowEffect(null), 1200);
  }, [updateLog]);

  const navItems = useMemo(() => [
    { key: "home", label: "홈", Icon: HomeIcon, color: NAV_TAB_COLORS.home },
    { key: "records", label: "기록", Icon: BookIcon, color: NAV_TAB_COLORS.records },
    { key: "timeline", label: "타임라인", Icon: ClockIcon, color: NAV_TAB_COLORS.timeline },
    { key: "settings", label: "설정", Icon: SettingsIcon, color: NAV_TAB_COLORS.settings },
  ], []);

  const renderPage = () => {
    switch (page) {
      case "records": return <RecordsPage
        readingLogs={readingLogs}
        studyLogs={studyLogs}
        cultureLogs={cultureLogs}
        loading={loading}
        onEditReading={openReadingEdit}
        onEditStudy={openStudyEdit}
        onEditCulture={openCultureEdit}
        onAddReading={addReadingProgress}
        layout={layout}
      />;
      case "timeline": return <TimelinePage logs={logs} loading={loading} layout={layout} />;
      case "settings": return <SettingsPage readingLogs={readingLogs} studyLogs={studyLogs} cultureLogs={cultureLogs} layout={layout} />;
      default: return <DashboardPage
        logs={logs}
        stats={stats}
        recentLogs={recentLogs}
        todayLabel={todayLabel}
        ringValues={ringValues}
        loading={loading}
        error={loadError}
        layout={layout}
      />;
    }
  };

  const iconButtonStyle = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: `radial-gradient(ellipse at top, #252220 0%, ${COLORS.dark.bg} 70%)`,
      fontFamily: "'Pretendard', 'Outfit', -apple-system, sans-serif",
      color: COLORS.dark.text,
      position: "relative", overflow: "hidden",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet" />

      {/* Global animations */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glowPulse { 
          0% { opacity: 0; } 
          30% { opacity: 1; } 
          100% { opacity: 0; } 
        }
        @keyframes prismShimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes viewSwitch {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardStaggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tabSwitch {
          from { opacity: 0; transform: translateY(10px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        * { box-sizing: border-box; }
        html, body, #root { margin: 0; min-height: 100%; }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input:focus, textarea:focus { border-color: rgba(255,255,255,0.2) !important; }
      `}</style>

      {/* Glow effect on save (edge glow) */}
      {glowEffect && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none",
          boxShadow: `inset 0 0 80px 20px ${glowEffect}`,
          animation: "glowPulse 1.2s ease-out forwards",
          borderRadius: 0,
        }} />
      )}

      {/* Header */}
      <header style={{
        padding: layout.isPhone ? "16px 16px 12px" : "18px 24px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(26,24,22,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${COLORS.dark.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* prism logo */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, position: "relative", overflow: "hidden",
            background: `linear-gradient(135deg, ${COLORS.reading.main}, ${COLORS.study.main}, ${COLORS.culture.main})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 18, height: 18, background: COLORS.dark.bg, borderRadius: 4,
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            }} />
          </div>
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
            background: `linear-gradient(90deg, ${COLORS.reading.main}, ${COLORS.study.main}, ${COLORS.culture.main})`,
            backgroundClip: "text",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "prismShimmer 3s ease-in-out infinite",
          }}>PrismLog</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: layout.isPhone ? 8 : 12 }}>
          <button type="button" style={iconButtonStyle}>
            <CalendarIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          <button type="button" style={iconButtonStyle}>
            <TagIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          {/* avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.reading.main}66, ${COLORS.culture.main}44)`,
            border: `1.5px solid ${COLORS.dark.border}`,
          }} />
        </div>
      </header>

      {/* Content */}
      <main style={{
        padding: layout.isPhone ? "20px 16px 132px" : "28px 24px 40px",
        maxWidth: layout.isTabletUp ? 1360 : 520,
        margin: "0 auto",
        animation: "fadeIn 0.45s ease-out",
      }}>
        <div style={{ display: "flex", gap: layout.isDesktop ? 24 : 20, alignItems: "flex-start" }}>
          {layout.isTabletUp && (
            <aside style={{ width: layout.isDesktop ? 220 : 92, flexShrink: 0, position: "sticky", top: 104 }}>
              <GlassCard style={{ padding: layout.isDesktop ? "14px" : "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {navItems.map((item) => {
                    const active = page === item.key;
                    const activeColor = item.color || "#f5f0eb";
                    const Icon = item.Icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPage(item.key)}
                        style={{
                          width: "100%",
                          minHeight: 52,
                          padding: layout.isDesktop ? "12px 14px" : "12px 10px",
                          borderRadius: 16,
                          border: `1px solid ${active ? `${activeColor}44` : "transparent"}`,
                          background: active ? `${activeColor}14` : "transparent",
                          display: "flex",
                          flexDirection: layout.isDesktop ? "row" : "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: layout.isDesktop ? 10 : 6,
                          cursor: "pointer",
                          color: active ? activeColor : COLORS.dark.textMuted,
                          fontSize: layout.isDesktop ? 14 : 11,
                          fontWeight: active ? 700 : 600,
                          fontFamily: "'Pretendard', sans-serif",
                          transition: "all 0.2s",
                        }}
                      >
                        <span><Icon size={layout.isDesktop ? 20 : 18} color="currentColor" /></span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>
            </aside>
          )}
          <div style={{ flex: 1, minWidth: 0, maxWidth: layout.isDesktop ? "none" : 920 }}>
            <div key={page} style={{ animation: "tabSwitch 0.3s cubic-bezier(.32,.72,.24,1)" }}>
              {renderPage()}
            </div>
          </div>
        </div>
      </main>

      {/* FAB */}
      {page !== "settings" && (
        <button
          onClick={() => { setSheetOpen(true); setNewLogCat("reading"); }}
          style={{
            position: "fixed", bottom: layout.isPhone ? "6.9rem" : 28, right: layout.isPhone ? 20 : 28,
            width: 56, height: 56, borderRadius: "50%", border: "none",
            background: COLORS.reading.main,
            boxShadow: `0 4px 16px ${COLORS.reading.glow}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s, box-shadow 0.2s", zIndex: 60,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <PlusIcon size={26} color="#fff" />
        </button>
      )}

      {/* Bottom Nav */}
      {!layout.isTabletUp && (
        <Suspense fallback={null}>
          <MobileFloatingNav items={navItems} activeKey={page} onChange={setPage} />
        </Suspense>
      )}

      {/* Bottom Sheet for new log */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={newLogCat === "reading" ? "새 책" : "새 기록"} layout={layout}>
        <CategorySelector selected={newLogCat} onSelect={setNewLogCat} layout={layout} />
        <NewLogForm category={newLogCat} onSubmit={saveLog} layout={layout} apiBaseUrl={API_BASE_URL} isOpen={sheetOpen} />
      </BottomSheet>

      <ReadingEditSheet
        open={Boolean(editingReading)}
        record={editingReading}
        onClose={() => setEditingReading(null)}
        onSave={saveReadingEdit}
        onDelete={deleteFromEdit}
        layout={layout}
        apiBaseUrl={API_BASE_URL}
      />

      <StudyEditSheet
        open={Boolean(editingStudy)}
        record={editingStudy}
        onClose={() => setEditingStudy(null)}
        onSave={saveStudyEdit}
        onDelete={deleteFromEdit}
        layout={layout}
      />

      <CultureEditSheet
        open={Boolean(editingCulture)}
        record={editingCulture}
        onClose={() => setEditingCulture(null)}
        onSave={saveCultureEdit}
        onDelete={deleteFromEdit}
        layout={layout}
      />
    </div>
  );
}
