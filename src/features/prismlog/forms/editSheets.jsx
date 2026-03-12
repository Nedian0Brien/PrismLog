import { useState, useEffect } from "react";
import BookAutocompleteField from "../../../components/BookAutocompleteField";
import MediaAutocompleteField from "../../../components/MediaAutocompleteField";
import {
  COLORS,
  CULTURE_TYPES,
  createReadingFormState,
  clearReadingMetadata,
  applyBookSelectionToReadingForm,
  applyBookEnrichmentToReadingForm,
  buildReadingPayload,
  fetchReadingEnrichment,
  formatReadingSourceSummary,
  normalizeMetadataObject,
  applyCultureSelectionToForm,
  clearCultureMetadata,
  fetchMediaEnrichment,
  getCultureStatusOptions,
  safeNumber,
  clamp,
  parseTags,
  normalizeCultureType,
  BookIcon,
} from "../core";
import { BottomSheet } from "../ui";
import {
  FORM_LABEL_STYLE,
  getFormInputStyle,
  getSplitFieldStyle,
  getPrimaryActionStyle,
  getDangerActionStyle,
} from "../formStyles";

export const ReadingEditSheet = ({ open, record, onClose, onSave, onDelete, layout, apiBaseUrl }) => {
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
      enrichmentProvider: record.enrichmentProvider || "",
      sourceMetadata: normalizeMetadataObject(record.sourceMetadata),
    });
    setPageEnriching(false);
    setMessage("");
  }, [record]);

  if (!record) return null;

  const inputStyle = getFormInputStyle();
  const labelStyle = FORM_LABEL_STYLE;
  const splitFieldStyle = getSplitFieldStyle(layout);

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
                const enrichment = await fetchReadingEnrichment(apiBaseUrl, isbn);
                if (!enrichment) return;
                setForm((prev) => (
                  prev.sourceId === selectedSourceId
                    ? applyBookEnrichmentToReadingForm(prev, enrichment)
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
        {(form.cover || form.sourceProvider || form.enrichmentProvider || form.description || Object.keys(normalizeMetadataObject(form.sourceMetadata)).length > 0) && (
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
                {formatReadingSourceSummary(form.sourceProvider, form.enrichmentProvider)}
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
                  페이지와 메타데이터를 보강하는 중...
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
          style={getPrimaryActionStyle({ accent: COLORS.reading.main, disabled: saving || deleting })}
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button
          onClick={remove}
          disabled={saving || deleting}
          style={getDangerActionStyle(saving || deleting)}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

export const StudyEditSheet = ({ open, record, onClose, onSave, onDelete, layout }) => {
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

  const inputStyle = getFormInputStyle();
  const labelStyle = FORM_LABEL_STYLE;
  const splitFieldStyle = getSplitFieldStyle(layout);

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
          style={getPrimaryActionStyle({ accent: COLORS.study.main, contrastText: "#1a1816", disabled: saving || deleting })}
        >
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button
          onClick={remove}
          disabled={saving || deleting}
          style={getDangerActionStyle(saving || deleting)}
        >
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

export const CultureEditSheet = ({ open, record, onClose, onSave, onDelete, layout, apiBaseUrl }) => {
  const [form, setForm] = useState({
    title: "", summary: "", type: "영화", status: "시청 중",
    playtime: "", rating: 0, tags: "",
    poster: "", releaseDate: "", sourceProvider: "", sourceId: "",
    episodeCount: null, seasonCount: null, runtime: null,
  });
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!record) return;
    const type = normalizeCultureType(record.type);
    setForm({
      title: record.title || "",
      summary: record.summary || "",
      type,
      status: record.status || (type === "게임" ? "플레이 중" : "시청 중"),
      playtime: record.playtime || "",
      rating: safeNumber(record.rating),
      tags: (record.tags || []).map((tag) => `#${tag}`).join(" "),
      poster: record.poster || "",
      releaseDate: record.releaseDate || "",
      sourceProvider: record.sourceProvider || "",
      sourceId: record.sourceId || "",
      episodeCount: null,
      seasonCount: null,
      runtime: null,
    });
    setEnriching(false);
    setMessage("");
  }, [record]);

  if (!record) return null;

  const inputStyle = getFormInputStyle();
  const labelStyle = FORM_LABEL_STYLE;
  const splitFieldStyle = getSplitFieldStyle(layout);
  const accent = COLORS.culture.main;

  const save = async () => {
    if (!form.title.trim()) { setMessage("제목을 입력해 주세요."); return; }
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
          poster: form.poster || null,
          release_date: form.releaseDate || null,
          episode_count: form.episodeCount ?? null,
          season_count: form.seasonCount ?? null,
          runtime: form.runtime ?? null,
          source_provider: form.sourceProvider || null,
          source_id: form.sourceId || null,
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

  const isGame = form.type === "게임";

  return (
    <BottomSheet open={open} onClose={onClose} title="문화 기록 수정" layout={layout}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 포스터 미리보기 */}
        {form.poster && (
          <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 14, border: `1px solid ${accent}22`, background: `${accent}12`, alignItems: "flex-start" }}>
            <img src={form.poster} alt="포스터" style={{ width: 52, height: 76, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>TMDB</span>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: COLORS.dark.textMuted }}>
                {[
                  form.releaseDate && `${form.releaseDate.slice(0, 4)}년`,
                  form.episodeCount ? `총 ${form.episodeCount}화` : form.runtime ? `${form.runtime}분` : null,
                ].filter(Boolean).join(" · ") || "메타데이터 불러옴"}
              </p>
              {enriching && <p style={{ margin: "2px 0 0", fontSize: 11, color: accent }}>정보 불러오는 중...</p>}
            </div>
          </div>
        )}

        {/* 제목 + 재검색 (게임이 아닐 때) */}
        {!isGame ? (
          <div>
            <label style={labelStyle}>콘텐츠 검색 / 제목 수정</label>
            <MediaAutocompleteField
              value={form.title}
              mediaType={form.type}
              onChange={(nextValue) => setForm((prev) => ({
                ...clearCultureMetadata(prev),
                title: nextValue,
              }))}
              onSelect={async (media) => {
                const selectedSourceId = media.source_id;
                setForm((prev) => applyCultureSelectionToForm(prev, media));
                const tmdbId = media.tmdb_id;
                const type = media.type;
                if (!tmdbId || !["movie", "series"].includes(type) || !apiBaseUrl) return;
                setEnriching(true);
                try {
                  const enrich = await fetchMediaEnrichment(apiBaseUrl, tmdbId, type);
                  if (!enrich) return;
                  setForm((prev) => {
                    if (prev.sourceId !== selectedSourceId) return prev;
                    return {
                      ...prev,
                      episodeCount: enrich.episode_count ?? null,
                      seasonCount: enrich.season_count ?? null,
                      runtime: enrich.runtime ?? null,
                    };
                  });
                } catch (err) {
                  console.error("media enrich failed", err);
                } finally {
                  setEnriching(false);
                }
              }}
              apiBaseUrl={apiBaseUrl}
              inputStyle={inputStyle}
              accentColor={accent}
              placeholder="제목으로 재검색..."
            />
          </div>
        ) : (
          <div><label style={labelStyle}>게임 제목</label><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} /></div>
        )}

        <div><label style={labelStyle}>메모</label><textarea value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} /></div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>유형</label><select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value, status: getCultureStatusOptions(e.target.value)[0] }))} style={inputStyle}>{CULTURE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div><label style={labelStyle}>상태</label><select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>{getCultureStatusOptions(form.type).map((status) => <option key={status}>{status}</option>)}</select></div>
        </div>
        <div style={splitFieldStyle}>
          <div><label style={labelStyle}>{isGame ? "플레이타임" : "시청 회차"}</label><input value={form.playtime} onChange={(e) => setForm((prev) => ({ ...prev, playtime: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>평점</label><input value={form.rating} onChange={(e) => setForm((prev) => ({ ...prev, rating: safeNumber(e.target.value) }))} style={inputStyle} type="number" min="0" max="5" /></div>
        </div>
        <div><label style={labelStyle}>태그</label><input value={form.tags} onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))} style={inputStyle} placeholder="#SF #드라마" /></div>
        {message && <p style={{ margin: 0, fontSize: 12, color: message.startsWith("저장 실패") ? "#f8b4bb" : COLORS.culture.light }}>{message}</p>}
        <button onClick={save} disabled={saving || deleting} style={getPrimaryActionStyle({ accent: COLORS.culture.main, disabled: saving || deleting })}>
          {saving ? "저장 중..." : "수정 내용 저장"}
        </button>
        <button onClick={remove} disabled={saving || deleting} style={getDangerActionStyle(saving || deleting)}>
          {deleting ? "삭제 중..." : "기록 삭제"}
        </button>
      </div>
    </BottomSheet>
  );
};

/* ──────────── Study Detail (Accordion) ──────────── */
