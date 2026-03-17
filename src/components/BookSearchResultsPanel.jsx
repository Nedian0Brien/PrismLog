import { useEffect, useState } from "react";

const PROVIDER_LABELS = {
  naver: "Naver",
  kakao: "Kakao",
};

export default function BookSearchResultsPanel({
  query,
  apiBaseUrl,
  accentColor,
  suspend = false,
  onSelect,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (suspend || trimmed.length < 2) {
      setItems([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/books/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `HTTP ${response.status}`);
        }
        const payload = await response.json();
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setItems([]);
        setError(error instanceof Error ? error.message : "검색 실패");
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiBaseUrl, query, suspend]);

  return (
    <div
      style={{
        minHeight: 300,
        maxHeight: 360,
        overflowY: "auto",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(20, 18, 17, 0.82)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {query.trim().length < 2 && (
        <div style={{ padding: "18px 16px", fontSize: 13, lineHeight: 1.6, color: "rgba(245,240,235,0.72)" }}>
          제목이나 ISBN을 2글자 이상 입력하면 이 영역에 검색 결과가 표시됩니다.
        </div>
      )}

      {query.trim().length >= 2 && loading && (
        <div style={{ padding: "18px 16px", fontSize: 13, color: "rgba(245,240,235,0.72)" }}>
          도서 정보를 찾는 중...
        </div>
      )}

      {query.trim().length >= 2 && !loading && error && (
        <div style={{ padding: "18px 16px", fontSize: 13, color: "#f8b4bb" }}>
          도서 검색 실패: 수동 입력은 계속 가능합니다.
        </div>
      )}

      {query.trim().length >= 2 && !loading && !error && items.length === 0 && (
        <div style={{ padding: "18px 16px", fontSize: 13, color: "rgba(245,240,235,0.72)" }}>
          검색 결과가 없습니다.
        </div>
      )}

      {items.map((item, index) => (
        <button
          key={item.source_id}
          type="button"
          onClick={() => onSelect(item)}
          style={{
            width: "100%",
            border: "none",
            borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
            background: "transparent",
            textAlign: "left",
            padding: "14px 16px",
            display: "flex",
            gap: 12,
            cursor: "pointer",
            color: "inherit",
            fontFamily: "'Pretendard', sans-serif",
          }}
        >
          <div
            style={{
              width: 42,
              height: 58,
              borderRadius: 10,
              overflow: "hidden",
              flexShrink: 0,
              background: `${accentColor}16`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.cover_url ? (
              <img src={item.cover_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <span style={{ fontSize: 10, color: accentColor }}>BOOK</span>
            )}
          </div>

          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <span style={{ 
              fontSize: 14, 
              fontWeight: 700, 
              color: "#f5f0eb", 
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {item.title}
            </span>
            <span style={{ 
              fontSize: 12, 
              color: "rgba(245,240,235,0.68)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {[item.authors?.join(", "), item.publisher, item.published_date].filter(Boolean).join(" · ")}
            </span>
            <span style={{ fontSize: 11, color: accentColor }}>
              {PROVIDER_LABELS[item.source_provider] || item.source_provider}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
