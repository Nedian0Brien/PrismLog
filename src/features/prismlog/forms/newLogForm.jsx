import { useState, useEffect, useMemo } from "react";
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
  DEMO_USER_ID,
  PlusIcon,
} from "../core";
import { Badge, ReadingProgressEditor, GlassCard } from "../ui";
import {
  FORM_LABEL_STYLE,
  getFormInputStyle,
  getSplitFieldStyle,
  getPrimaryActionStyle,
} from "../formStyles";

export const NewLogForm = ({ category, onSubmit, layout, apiBaseUrl, isOpen }) => {
  const colorMap = { reading: COLORS.reading.main, study: COLORS.study.main, culture: COLORS.culture.main };
  const accent = colorMap[category];
  
  // 상태 관리
  const [step, setStep] = useState("select-entity"); // select-entity, search, details
  const [entities, setEntities] = useState([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  // 폼 상태 (기존 유지하되 히스토리용으로 활용)
  const [readingForm, setReadingForm] = useState(createReadingFormState);
  const [cultureForm, setCultureForm] = useState(createCultureFormState);
  const [studyForm, setStudyForm] = useState({
    title: "", retrospect: "", tags: "", progressMode: "chapter", pages: "", readPages: "",
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [searchComposing, setSearchComposing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [pageMessage, setPageMessage] = useState("");

  const inputStyle = getFormInputStyle();
  const labelStyle = FORM_LABEL_STYLE;
  const actionButtonStyle = getPrimaryActionStyle({
    accent,
    contrastText: category === "study" ? "#1a1816" : "#fff",
    disabled: submitting,
  });
  const splitFieldStyle = getSplitFieldStyle(layout);

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

  // 닫힐 때 초기화
  useEffect(() => {
    if (!isOpen) {
      setStep("select-entity");
      setSelectedEntity(null);
      setReadingForm(createReadingFormState());
      setCultureForm(createCultureFormState());
      setStudyForm({ title: "", retrospect: "", tags: "", progressMode: "chapter", pages: "", readPages: "" });
      setSubmitMessage("");
    }
  }, [isOpen]);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setSubmitMessage("");
    try {
      // 1. 만약 엔티티가 새로 생성되어야 하는 상황이면 (selectedEntity가 없고 search 결과에서 온 경우)
      //    이 로직은 아래 onSubmit 호출 시 백엔드에서 처리하거나, 여기서 먼저 생성해야 함.
      //    구조상 onSubmit 내부에서 LogEntity 생성과 Log 생성을 같이 처리하도록 유도하거나,
      //    여기서 분리 처리함. (여기서는 백엔드 API /logs/entities 를 먼저 부르는 방식 선택)
      
      let entityId = selectedEntity?.id;
      
      if (!entityId) {
        // 신규 엔티티 생성 API 호출
        const entityPayload = {
          user_id: DEMO_USER_ID,
          category: category,
          title: payload.title,
          source_id: payload.payload.source_id || payload.payload.isbn13 || payload.payload.isbn,
          entity_metadata: payload.payload, // 메타데이터로 저장
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
      
      // 2. 실제 활동 로그 저장
      const logPayload = {
        ...payload,
        user_id: DEMO_USER_ID,
        entity_id: entityId,
        occurred_at: new Date().toISOString(), // 현재 시간 기록
      };
      
      await onSubmit(logPayload);
      setSubmitMessage("저장 완료");
      setTimeout(() => setStep("select-entity"), 1000);
    } catch (error) {
      setSubmitMessage(`저장 실패: ${error.message}`);
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
              onClick={() => setStep("search")}
              style={{
                padding: "20px", borderRadius: 20, border: `2px dashed ${accent}44`,
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
                  // 엔티티 정보를 폼에 미리 채워넣음 (기존 데이터 호환)
                  if (category === "reading") {
                    setReadingForm(prev => ({ 
                      ...prev, 
                      title: entity.title, 
                      cover: entity.entity_metadata?.cover || "",
                      pages: String(entity.entity_metadata?.pages_total || ""),
                      author: entity.entity_metadata?.author || "",
                    }));
                  }
                  setStep("details");
                }}
                style={{
                  padding: "14px", borderRadius: 20, border: `1px solid ${COLORS.dark.border}`,
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
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.dark.textMuted }}>{entity.category} · {new Date(entity.updated_at).toLocaleDateString()} 업데이트</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- 2단계: 검색 화면 (기존 로직 활용) ---
  if (step === "search") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>새로운 {category === "reading" ? "책" : category === "study" ? "교재" : "콘텐츠"} 찾기</h3>
          <button onClick={() => setStep("select-entity")} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>뒤로가기</button>
        </div>
        
        <input
          style={inputStyle}
          placeholder="제목이나 키워드로 검색..."
          onChange={(e) => {
            const val = e.target.value;
            if (category === "reading") setReadingForm(prev => ({ ...prev, title: val }));
            else if (category === "culture") setCultureForm(prev => ({ ...prev, title: val }));
            else setStudyForm(prev => ({ ...prev, title: val }));
          }}
          onCompositionStart={() => setSearchComposing(true)}
          onCompositionEnd={() => setSearchComposing(false)}
        />
        
        {category === "reading" && (
          <BookSearchResultsPanel
            query={readingForm.title}
            apiBaseUrl={apiBaseUrl}
            accentColor={accent}
            suspend={searchComposing}
            onSelect={async (book) => {
              setReadingForm(prev => applyBookSelectionToReadingForm(prev, book));
              setStep("details");
              // 보강 로직 생략(필요시 추가)
            }}
          />
        )}
        
        {category === "culture" && (
          <MediaSearchResultsPanel
            query={cultureForm.title}
            mediaType={cultureForm.type}
            apiBaseUrl={apiBaseUrl}
            accentColor={accent}
            suspend={searchComposing}
            onSelect={async (media) => {
              setCultureForm(prev => applyCultureSelectionToForm(prev, media));
              setStep("details");
            }}
          />
        )}
        
        <button
          onClick={() => setStep("details")}
          style={{ padding: "14px", borderRadius: 16, border: `1px solid ${accent}44`, background: "transparent", color: accent, cursor: "pointer", fontWeight: 700 }}
        >
          검색 결과 없음, 직접 입력하기
        </button>
      </div>
    );
  }

  // --- 3단계: 상세 기록 입력 (History 추가) ---
  if (step === "details") {
    const isReading = category === "reading";
    const isStudy = category === "study";
    const isCulture = category === "culture";
    
    // 현재 표시할 제목/커버 정보 결정
    const displayTitle = selectedEntity?.title || (isReading ? readingForm.title : isCulture ? cultureForm.title : studyForm.title);
    const displayCover = selectedEntity?.entity_metadata?.cover || selectedEntity?.entity_metadata?.poster || (isReading ? readingForm.cover : isCulture ? cultureForm.poster : "");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* 상단 엔티티 정보 요약 */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "12px", borderRadius: 18, background: `${accent}12`, border: `1px solid ${accent}22` }}>
          <div style={{ width: 50, height: 70, borderRadius: 8, background: `${accent}22`, overflow: "hidden", flexShrink: 0 }}>
            {displayCover && <img src={displayCover} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: COLORS.dark.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTitle}</h4>
            <button onClick={() => setStep("select-entity")} style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>대상 변경</button>
          </div>
        </div>

        {/* 활동 내용 입력 필드 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isReading && (
            <>
              <label style={labelStyle}>어디까지 읽었나요?</label>
              <ReadingProgressEditor
                layout={layout}
                accent={accent}
                currentValue={safeNumber(readingForm.readPages)}
                totalPages={safeNumber(readingForm.pages)}
                derivedProgress={clamp(Math.round((safeNumber(readingForm.readPages) / Math.max(1, safeNumber(readingForm.pages))) * 100), 0, 100)}
                derivedReadPages={safeNumber(readingForm.readPages)}
                onCurrentChange={(val) => setReadingForm(prev => ({ ...prev, readPages: val }))}
                onTotalChange={(val) => setReadingForm(prev => ({ ...prev, pages: val }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 100 }}
                placeholder="오늘 읽은 내용 중 기억에 남는 것은?"
                value={readingForm.memo}
                onChange={(e) => setReadingForm(prev => ({ ...prev, memo: e.target.value }))}
              />
            </>
          )}

          {isStudy && (
            <>
              <div><label style={labelStyle}>오늘 공부한 내용</label><textarea style={{ ...inputStyle, minHeight: 100 }} placeholder="무엇을 배웠나요?" value={studyForm.retrospect} onChange={(e) => setStudyForm(prev => ({ ...prev, retrospect: e.target.value }))} /></div>
              <div style={splitFieldStyle}>
                <div><label style={labelStyle}>진행 페이지</label><input style={inputStyle} type="number" value={studyForm.readPages} onChange={(e) => setStudyForm(prev => ({ ...prev, readPages: e.target.value }))} /></div>
                <div><label style={labelStyle}>전체 페이지</label><input style={inputStyle} type="number" value={studyForm.pages} onChange={(e) => setStudyForm(prev => ({ ...prev, pages: e.target.value }))} /></div>
              </div>
            </>
          )}

          {isCulture && (
            <>
              <div><label style={labelStyle}>감상평</label><textarea style={{ ...inputStyle, minHeight: 100 }} placeholder="어땠나요?" value={cultureForm.overview} onChange={(e) => setCultureForm(prev => ({ ...prev, overview: e.target.value }))} /></div>
              <div style={splitFieldStyle}>
                <div><label style={labelStyle}>{cultureForm.type === "시리즈" ? "시청한 회차" : "상태"}</label>
                  <input style={inputStyle} value={cultureForm.watchedEpisodes} onChange={(e) => setCultureForm(prev => ({ ...prev, watchedEpisodes: e.target.value }))} />
                </div>
                <div><label style={labelStyle}>평점</label><input style={inputStyle} type="number" min="0" max="5" value={cultureForm.rating} onChange={(e) => setCultureForm(prev => ({ ...prev, rating: e.target.value }))} /></div>
              </div>
            </>
          )}

          <div><label style={labelStyle}>태그</label><input style={inputStyle} placeholder="#태그 #입력" onChange={(e) => {
            if (isReading) setReadingForm(prev => ({ ...prev, tags: e.target.value }));
            else if (isStudy) setStudyForm(prev => ({ ...prev, tags: e.target.value }));
            else setCultureForm(prev => ({ ...prev, tags: e.target.value }));
          }} /></div>
        </div>

        {submitMessage && <p style={{ margin: 0, fontSize: 13, color: accent }}>{submitMessage}</p>}
        
        <button
          disabled={submitting}
          style={actionButtonStyle}
          onClick={() => {
            const payload = isReading 
              ? { category: "reading", title: displayTitle, summary: readingForm.memo, tags: parseTags(readingForm.tags), payload: buildReadingPayload(readingForm) }
              : isStudy
              ? { category: "study", title: displayTitle, summary: studyForm.retrospect, tags: parseTags(studyForm.tags), payload: { pages_read: studyForm.readPages, pages_total: studyForm.pages } }
              : { category: "culture", title: displayTitle, summary: cultureForm.overview, tags: parseTags(cultureForm.tags), payload: buildCulturePayload(cultureForm) };
            
            handleSave(payload);
          }}
        >
          {submitting ? "기록 중..." : "기록 남기기"}
        </button>
      </div>
    );
  }

  return null;
};
