import { useEffect, useRef, useState } from "react";

const PROVIDER_LABELS = {
  naver: "Naver",
  kakao: "Kakao",
};

export default function BookAutocompleteField({
  value,
  onChange,
  onSelect,
  apiBaseUrl,
  inputStyle,
  accentColor,
  placeholder = "제목 또는 ISBN으로 검색...",
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
        const response = await fetch(
          `${apiBaseUrl}/api/v1/books/search?q=${encodeURIComponent(query)}&limit=6`,
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
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setItems([]);
        setOpen(true);
        setHighlightedIndex(-1);
        setError(error instanceof Error ? error.message : "검색 실패");
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiBaseUrl, disabled, isComposing, value]);

  const selectItem = (item) => {
    onSelect(item);
    setItems([]);
    setOpen(false);
    setError("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!open || items.length === 0) {
      if (event.key === "ArrowDown" && items.length > 0) {
        setOpen(true);
      }
      return;
    }

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

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const itemStyle = (active) => ({
    width: "100%",
    border: "none",
    background: active ? `${accentColor}18` : "transparent",
    color: active ? "#fff" : "inherit",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
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
        <div
          style={{
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
          }}
        >
          {loading && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "rgba(245,240,235,0.75)" }}>
              도서 정보를 찾는 중...
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#f8b4bb" }}>
              도서 검색 실패: 수동 입력은 계속 가능합니다.
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
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {item.title}
              </span>
              <span style={{ fontSize: 11, color: index === highlightedIndex ? "rgba(255,255,255,0.78)" : "rgba(245,240,235,0.65)" }}>
                {[item.authors?.join(", "), item.publisher, item.published_date].filter(Boolean).join(" · ")}
              </span>
              <span style={{ fontSize: 10, color: index === highlightedIndex ? "rgba(255,255,255,0.72)" : accentColor }}>
                {PROVIDER_LABELS[item.source_provider] || item.source_provider}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
