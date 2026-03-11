import { useMemo } from "react";
import { COLORS } from "../core";
import { GlassCard } from "../ui";

export const SettingsPage = ({ readingLogs, studyLogs, cultureLogs, layout }) => {
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
