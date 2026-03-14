import { useEffect, useRef, useState } from "react";

const TYPE_LABELS = { movie: "영화", series: "시리즈" };

export default function MediaAutocompleteField({
  value,
  mediaType,
  onChange,
  onSelect,
  apiBaseUrl,
  inputStyle,
  accentColor,
  placeholder = "제목으로 검색...",
  disabled = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isComposing, setIsComposing] = useState(false);
  const blurTimerRef = useRef(null);

  useEffect(() => () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (disabled || isComposing || query.length < 2) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setError("");
      setHighlightedIndex(-1);
      return undefined;
    }

    setOpen(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const type = mediaType === "게임" ? "game" : mediaType === "시리즈" ? "series" : "movie";
        const response = await fetch(
          `${apiBaseUrl}/api/v1/media/search?q=${encodeURIComponent(query)}&type=${type}&limit=6`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setItems(nextItems);
        setOpen(true);
        setHighlightedIndex(nextItems.length > 0 ? 0 : -1);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setItems([]);
        setOpen(true);
        setHighlightedIndex(-1);
        setError(err instanceof Error ? err.message : "검색 실패");
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiBaseUrl, disabled, isComposing, mediaType, value]);

  const selectItem = (item) => {
    onSelect(item);
    setItems([]);
    setOpen(false);
    setError("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
      return;
    }
    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectItem(items[highlightedIndex]);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  };

  const itemStyle = (active) => ({
    width: "100%",
    border: "none",
    background: active ? `${accentColor}18` : "transparent",
    color: active ? "#fff" : "inherit",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Pretendard', sans-serif",
  });

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          if (nextValue.trim().length >= 2) setOpen(true);
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={(event) => {
          setIsComposing(false);
          const nextValue = event.currentTarget.value;
          onChange(nextValue);
          if (nextValue.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2 || items.length > 0 || error || loading) setOpen(true);
        }}
        onBlur={() => {
          blurTimerRef.current = window.setTimeout(() => setOpen(false), 140);
        }}
        onKeyDown={handleKeyDown}
        style={inputStyle}
        placeholder={placeholder}
        disabled={disabled}
      />

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          right: 0,
          zIndex: 40,
          borderRadius: 14,
          overflow: "hidden",
          background: "rgba(27, 24, 22, 0.96)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          backdropFilter: "blur(18px)",
        }}>
          {loading && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "rgba(245,240,235,0.75)" }}>
              콘텐츠 정보를 찾는 중...
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#f8b4bb" }}>
              검색 실패: 수동 입력으로 계속할 수 있습니다.
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "rgba(245,240,235,0.75)" }}>
              검색 결과가 없습니다. 직접 입력하세요.
            </div>
          )}

          {!loading && !error && items.map((item, index) => (
            <button
              key={item.source_id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(item);
              }}
              style={itemStyle(index === highlightedIndex)}
            >
              {item.poster_url && (
                <img
                  src={item.poster_url}
                  alt=""
                  style={{ width: 32, height: 46, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: index === highlightedIndex ? "rgba(255,255,255,0.7)" : "rgba(245,240,235,0.55)", marginTop: 2 }}>
                  {[TYPE_LABELS[item.type] || item.type, item.release_date?.slice(0, 4)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
