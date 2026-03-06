import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ──────────── Color Tokens ──────────── */
const COLORS = {
  dark: {
    bg: "#1a1816",
    surface: "rgba(40, 36, 33, 0.7)",
    surfaceSolid: "#282421",
    card: "rgba(50, 45, 41, 0.55)",
    text: "#f5f0eb",
    textMuted: "#a09890",
    border: "rgba(255,255,255,0.07)",
    glassBlur: "blur(18px)",
  },
  reading: { main: "#2db5a3", glow: "rgba(45,181,163,0.35)", light: "#3fd4bf" },
  study: { main: "#f0c930", glow: "rgba(240,201,48,0.35)", light: "#f7da5e" },
  culture: { main: "#e63946", glow: "rgba(230,57,70,0.35)", light: "#f25d69" },
};

/* ──────────── Icons (inline SVG) ──────────── */
const BookIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const PenIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const FilmIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" />
  </svg>
);
const PlusIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const CalendarIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const TagIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const ChevronDown = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
);
const StarIcon = ({ size = 16, filled = false, color = "#f0c930" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const XIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const HomeIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const BarChartIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const CheckIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
);

/* ──────────── Mock Data ──────────── */
const MOCK_BOOKS = [
  { id: 1, title: "역행자", author: "자청", cover: null, progress: 78, pages: 280, readPages: 218, rating: 4, review: "실행력에 대한 생각을 바꿔준 책", tags: ["자기계발", "마인드셋"], date: "2026-03-04" },
  { id: 2, title: "원씽", author: "게리 켈러", cover: null, progress: 100, pages: 320, readPages: 320, rating: 5, review: "집중의 본질을 알려주는 명작", tags: ["자기계발", "생산성"], date: "2026-02-28" },
  { id: 3, title: "데미안", author: "헤르만 헤세", cover: null, progress: 45, pages: 200, readPages: 90, rating: 0, review: "", tags: ["소설", "고전"], date: "2026-03-06" },
  { id: 4, title: "클린 코드", author: "로버트 마틴", cover: null, progress: 32, pages: 464, readPages: 148, rating: 0, review: "", tags: ["개발", "프로그래밍"], date: "2026-03-01" },
];

const MOCK_STUDIES = [
  { id: 1, title: "FastAPI 마스터 클래스", progress: 62, chapters: ["소개 및 환경설정", "라우팅과 엔드포인트", "Pydantic 모델", "데이터베이스 연동", "인증 및 보안", "배포"], completed: [true, true, true, false, false, false], goal: "주 3회 학습", date: "2026-03-06", tags: ["백엔드", "Python"] },
  { id: 2, title: "Next.js 14 심화", progress: 85, chapters: ["App Router 기초", "Server Components", "Data Fetching", "Middleware", "배포 최적화"], completed: [true, true, true, true, false], goal: "주 2회 학습", date: "2026-03-05", tags: ["프론트엔드", "React"] },
  { id: 3, title: "알고리즘 문제풀이", progress: 40, chapters: ["정렬", "탐색", "그래프", "DP", "그리디"], completed: [true, true, false, false, false], goal: "매일 1문제", date: "2026-03-04", tags: ["알고리즘", "코딩테스트"] },
];

const MOCK_CULTURE = [
  { id: 1, title: "듄: 파트 3", type: "영화", status: "기대 중", poster: null, rating: 0, date: "2026-03-10", tags: ["SF", "액션"], playtime: null },
  { id: 2, title: "쇼군 시즌 2", type: "TV", status: "시청 중", poster: null, rating: 0, date: "2026-03-05", tags: ["드라마", "역사"], playtime: "8화 / 10화" },
  { id: 3, title: "엘든 링: 나이트레인", type: "게임", status: "플레이 중", poster: null, rating: 0, date: "2026-03-03", tags: ["RPG", "액션"], playtime: "42시간" },
  { id: 4, title: "오펜하이머", type: "영화", status: "시청 완료", poster: null, rating: 5, date: "2026-02-20", tags: ["전기", "드라마"], playtime: null },
  { id: 5, title: "라스트 오브 어스 시즌 2", type: "TV", status: "시청 완료", poster: null, rating: 4, date: "2026-02-15", tags: ["드라마", "스릴러"], playtime: null },
];

const WEEK_HEATMAP = [
  [1, 2, 0, 3, 1, 2, 0],
  [2, 3, 1, 0, 2, 1, 3],
  [0, 1, 2, 2, 3, 0, 1],
  [3, 2, 1, 3, 0, 2, 2],
  [1, 0, 3, 2, 1, 3, null],
];

/* ──────────── Utility Components ──────────── */
const GlassCard = ({ children, style = {}, className = "", onClick, glow }) => (
  <div
    onClick={onClick}
    className={className}
    style={{
      background: COLORS.dark.card,
      backdropFilter: COLORS.dark.glassBlur,
      WebkitBackdropFilter: COLORS.dark.glassBlur,
      border: `1px solid ${COLORS.dark.border}`,
      borderRadius: 20,
      padding: "20px",
      position: "relative",
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
      ...style,
    }}
  >
    {glow && (
      <div style={{
        position: "absolute", top: -40, right: -40, width: 120, height: 120,
        background: glow, borderRadius: "50%", filter: "blur(50px)", opacity: 0.5, pointerEvents: "none",
      }} />
    )}
    {children}
  </div>
);

const ProgressBar = ({ value, color, height = 6 }) => (
  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: height, height, width: "100%", overflow: "hidden" }}>
    <div style={{
      width: `${value}%`, height: "100%", borderRadius: height,
      background: `linear-gradient(90deg, ${color}, ${color}aa)`,
      transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
      boxShadow: `0 0 12px ${color}55`,
    }} />
  </div>
);

const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-block", padding: "3px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    background: `${color}22`, color: color, border: `1px solid ${color}33`,
  }}>{text}</span>
);

const StatusBadge = ({ status }) => {
  const map = {
    "시청 중": { bg: "#2db5a322", color: "#2db5a3", border: "#2db5a333" },
    "플레이 중": { bg: "#2db5a322", color: "#2db5a3", border: "#2db5a333" },
    "시청 완료": { bg: "#f0c93022", color: "#f0c930", border: "#f0c93033" },
    "기대 중": { bg: "#e6394622", color: "#e63946", border: "#e6394633" },
    "중도 하차": { bg: "#a0989022", color: "#a09890", border: "#a0989033" },
  };
  const s = map[status] || map["중도 하차"];
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status}</span>;
};

const RatingStars = ({ rating, size = 14 }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => <StarIcon key={i} size={size} filled={i <= rating} />)}
  </div>
);

/* ──────────── Spectrum Ring Chart ──────────── */
const SpectrumRing = ({ reading = 35, study = 40, culture = 25 }) => {
  const total = reading + study + culture || 1;
  const r = 70, cx = 90, cy = 90, stroke = 14;
  const circ = 2 * Math.PI * r;
  const seg = [
    { pct: reading / total, color: COLORS.reading.main },
    { pct: study / total, color: COLORS.study.main },
    { pct: culture / total, color: COLORS.culture.main },
  ];
  let offset = 0;
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <defs>
        {seg.map((s, i) => (
          <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={s.color} />
            <stop offset="100%" stopColor={s.color} stopOpacity="0.6" />
          </linearGradient>
        ))}
        <filter id="ring-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      {seg.map((s, i) => {
        const dashLen = circ * s.pct;
        const dashOff = circ * offset;
        offset += s.pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={`url(#grad-${i})`}
            strokeWidth={stroke} strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={-dashOff} strokeLinecap="round" filter="url(#ring-glow)"
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "all 1s ease" }}
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={COLORS.dark.text} fontSize="22" fontWeight="700" fontFamily="'Outfit', sans-serif">
        {reading + study + culture}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={COLORS.dark.textMuted} fontSize="11" fontFamily="'Outfit', sans-serif">
        이번 달 기록
      </text>
    </svg>
  );
};

/* ──────────── Heatmap ──────────── */
const Heatmap = () => {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const getColor = (v) => {
    if (v === null) return "transparent";
    if (v === 0) return "rgba(255,255,255,0.04)";
    const colors = ["", "rgba(45,181,163,0.3)", "rgba(240,201,48,0.45)", "rgba(230,57,70,0.5)"];
    return colors[v] || colors[3];
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {days.map(d => <div key={d} style={{ width: 28, textAlign: "center", fontSize: 10, color: COLORS.dark.textMuted }}>{d}</div>)}
      </div>
      {WEEK_HEATMAP.map((week, wi) => (
        <div key={wi} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
          {week.map((v, di) => (
            <div key={di} style={{
              width: 28, height: 28, borderRadius: 6, background: getColor(v),
              border: v !== null ? "1px solid rgba(255,255,255,0.04)" : "none",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      ))}
    </div>
  );
};

/* ──────────── Bottom Sheet ──────────── */
const BottomSheet = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 480, maxHeight: "85vh",
        background: COLORS.dark.surfaceSolid, borderRadius: "24px 24px 0 0",
        padding: "8px 0 0", overflow: "hidden",
        animation: "slideUp 0.35s cubic-bezier(.32,.72,.24,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />
        <div style={{ padding: "0 24px 32px", overflowY: "auto", maxHeight: "calc(85vh - 40px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark.text, fontFamily: "'Outfit', sans-serif", margin: 0 }}>{title}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <XIcon color={COLORS.dark.textMuted} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

/* ──────────── Category Selector in BottomSheet ──────────── */
const CategorySelector = ({ selected, onSelect }) => {
  const cats = [
    { key: "reading", label: "독서", icon: <BookIcon size={22} />, color: COLORS.reading.main },
    { key: "study", label: "공부", icon: <PenIcon size={22} />, color: COLORS.study.main },
    { key: "culture", label: "문화", icon: <FilmIcon size={22} />, color: COLORS.culture.main },
  ];
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
      {cats.map(c => (
        <button key={c.key} onClick={() => onSelect(c.key)} style={{
          flex: 1, padding: "14px 8px", borderRadius: 16, border: `1.5px solid ${selected === c.key ? c.color : COLORS.dark.border}`,
          background: selected === c.key ? `${c.color}15` : "transparent", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          transition: "all 0.25s",
        }}>
          <span style={{ color: selected === c.key ? c.color : COLORS.dark.textMuted }}>{c.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: selected === c.key ? c.color : COLORS.dark.textMuted }}>{c.label}</span>
        </button>
      ))}
    </div>
  );
};

/* ──────────── New Log Form ──────────── */
const NewLogForm = ({ category }) => {
  const colorMap = { reading: COLORS.reading.main, study: COLORS.study.main, culture: COLORS.culture.main };
  const accent = colorMap[category];
  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14,
    background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.dark.border}`,
    color: COLORS.dark.text, outline: "none", fontFamily: "'Pretendard', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: COLORS.dark.textMuted, marginBottom: 6, display: "block" };

  if (category === "reading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={labelStyle}>도서 검색</label><input style={inputStyle} placeholder="제목 또는 ISBN으로 검색..." /></div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><label style={labelStyle}>읽은 페이지</label><input style={inputStyle} type="number" placeholder="0" /></div>
          <div style={{ flex: 1 }}><label style={labelStyle}>전체 페이지</label><input style={inputStyle} type="number" placeholder="0" /></div>
        </div>
        <div><label style={labelStyle}>메모 / 필사</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="기억하고 싶은 문장이나 생각..." /></div>
        <div><label style={labelStyle}>평점</label><RatingStars rating={0} size={24} /></div>
        <div><label style={labelStyle}>한 줄 평</label><input style={inputStyle} placeholder="이 책을 한 마디로..." /></div>
        <div><label style={labelStyle}>태그</label><input style={inputStyle} placeholder="#자기계발 #소설 ..." /></div>
        <button style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff", cursor: "pointer",
          boxShadow: `0 4px 20px ${accent}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif",
        }}>기록 저장하기</button>
      </div>
    );
  }
  if (category === "study") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={labelStyle}>학습 주제</label><input style={inputStyle} placeholder="학습 주제를 입력하세요" /></div>
        <div><label style={labelStyle}>자료 첨부 (URL / 텍스트)</label><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="학습 자료 URL 또는 목차를 붙여넣기..." /></div>
        <button style={{
          width: "100%", padding: "12px", borderRadius: 12, border: `1.5px dashed ${accent}66`, fontSize: 13, fontWeight: 600,
          background: `${accent}0a`, color: accent, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
        }}>✦ AI로 목차 자동 생성</button>
        <div><label style={labelStyle}>학습 목표</label><input style={inputStyle} placeholder="예: 주 3회, 매일 1시간" /></div>
        <div><label style={labelStyle}>오늘의 회고</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="오늘 배운 핵심 내용 요약..." /></div>
        <div><label style={labelStyle}>태그</label><input style={inputStyle} placeholder="#코딩 #AI ..." /></div>
        <button style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#1a1816", cursor: "pointer",
          boxShadow: `0 4px 20px ${accent}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif",
        }}>기록 저장하기</button>
      </div>
    );
  }
  // culture
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><label style={labelStyle}>콘텐츠 검색</label><input style={inputStyle} placeholder="영화, TV, 게임 제목 검색..." /></div>
      <div><label style={labelStyle}>유형</label>
        <div style={{ display: "flex", gap: 8 }}>
          {["영화", "TV", "게임"].map(t => (
            <button key={t} style={{
              padding: "8px 16px", borderRadius: 10, border: `1px solid ${COLORS.dark.border}`,
              background: "rgba(255,255,255,0.04)", color: COLORS.dark.textMuted, fontSize: 13,
              fontWeight: 600, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div><label style={labelStyle}>상태</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["시청 중", "시청 완료", "중도 하차", "기대 중", "플레이 중"].map(s => (
            <button key={s} style={{
              padding: "8px 14px", borderRadius: 10, border: `1px solid ${COLORS.dark.border}`,
              background: "rgba(255,255,255,0.04)", color: COLORS.dark.textMuted, fontSize: 12,
              fontWeight: 600, cursor: "pointer", fontFamily: "'Pretendard', sans-serif",
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div><label style={labelStyle}>평점</label><RatingStars rating={0} size={24} /></div>
      <div><label style={labelStyle}>태그</label><input style={inputStyle} placeholder="#SF #드라마 ..." /></div>
      <button style={{
        width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff", cursor: "pointer",
        boxShadow: `0 4px 20px ${accent}44`, transition: "all 0.25s", fontFamily: "'Pretendard', sans-serif",
      }}>기록 저장하기</button>
    </div>
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
const DashboardPage = ({ onNavigate }) => {
  const stats = [
    { label: "독서", value: "4권", sub: "이번 달", color: COLORS.reading.main, icon: <BookIcon size={18} color={COLORS.reading.main} /> },
    { label: "공부", value: "38h", sub: "이번 달", color: COLORS.study.main, icon: <PenIcon size={18} color={COLORS.study.main} /> },
    { label: "문화", value: "5편", sub: "이번 달", color: COLORS.culture.main, icon: <FilmIcon size={18} color={COLORS.culture.main} /> },
  ];

  const recentLogs = [
    { type: "reading", title: "데미안 · 45% 읽음", color: COLORS.reading.main, time: "오늘" },
    { type: "study", title: "FastAPI · 4장 완료", color: COLORS.study.main, time: "오늘" },
    { type: "culture", title: "쇼군 시즌2 · 8화 시청", color: COLORS.culture.main, time: "어제" },
    { type: "reading", title: "역행자 · 78% 읽음", color: COLORS.reading.main, time: "3일 전" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* greeting */}
      <div style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 14, color: COLORS.dark.textMuted, margin: "0 0 4px", fontFamily: "'Outfit', sans-serif" }}>2026년 3월 6일 목요일</p>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif", lineHeight: 1.3 }}>
          오늘도 기록하러 오셨군요 <span style={{ fontSize: 22 }}>✦</span>
        </h2>
      </div>

      {/* spectrum ring + stats */}
      <GlassCard style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <SpectrumRing reading={4} study={6} culture={5} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {stats.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {s.icon}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark.text }}>{s.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Outfit', sans-serif" }}>{s.value}</span>
                </div>
                <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{s.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* heatmap */}
      <GlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>기록 히트맵</h4>
          <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>3월</span>
        </div>
        <Heatmap />
        <div style={{ display: "flex", gap: 12, marginTop: 10, justifyContent: "flex-end" }}>
          {[
            { label: "독서", color: COLORS.reading.main },
            { label: "공부", color: COLORS.study.main },
            { label: "문화", color: COLORS.culture.main },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 3, background: l.color, opacity: 0.6 }} />
              <span style={{ fontSize: 10, color: COLORS.dark.textMuted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* recent logs */}
      <div>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 12px", fontFamily: "'Outfit', sans-serif" }}>최근 기록</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentLogs.map((log, i) => (
            <GlassCard key={i} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 4, height: 32, borderRadius: 2, background: log.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark.text, margin: 0 }}>{log.title}</p>
              </div>
              <span style={{ fontSize: 11, color: COLORS.dark.textMuted, flexShrink: 0 }}>{log.time}</span>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ──────────── Page: Reading ──────────── */
const ReadingPage = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <span style={{ color: COLORS.reading.main }}>📚</span> 독서 기록
      </h3>
      <span style={{ fontSize: 13, color: COLORS.dark.textMuted }}>{MOCK_BOOKS.length}권</span>
    </div>
    {MOCK_BOOKS.map(book => (
      <GlassCard key={book.id} glow={COLORS.reading.glow} style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 16 }}>
          {/* book cover placeholder */}
          <div style={{
            width: 60, height: 84, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${COLORS.reading.main}33, ${COLORS.reading.main}11)`,
            border: `1px solid ${COLORS.reading.main}22`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookIcon size={24} color={COLORS.reading.main} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 2px", fontFamily: "'Pretendard', sans-serif" }}>{book.title}</h4>
            <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: "0 0 10px" }}>{book.author}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ProgressBar value={book.progress} color={COLORS.reading.main} />
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.reading.main, fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>{book.progress}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{book.readPages}/{book.pages}p</span>
              {book.rating > 0 && <RatingStars rating={book.rating} size={12} />}
            </div>
            {book.review && <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: "8px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>"{book.review}"</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {book.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.reading.main} />)}
            </div>
          </div>
        </div>
      </GlassCard>
    ))}
  </div>
);

/* ──────────── Page: Study ──────────── */
const StudyPage = () => {
  const [detailId, setDetailId] = useState(null);
  const detail = MOCK_STUDIES.find(s => s.id === detailId);
  if (detail) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setDetailId(null)} style={{
          background: "none", border: "none", color: COLORS.study.main, fontSize: 13,
          fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "'Pretendard', sans-serif",
        }}>← 뒤로</button>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>{detail.title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ProgressBar value={detail.progress} color={COLORS.study.main} height={8} />
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.study.main, fontFamily: "'Outfit', sans-serif" }}>{detail.progress}%</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Badge text={detail.goal} color={COLORS.study.main} />
          {detail.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.study.main} />)}
        </div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark.textMuted, margin: "8px 0 4px", fontFamily: "'Outfit', sans-serif" }}>학습 목차</h4>
        <StudyAccordion study={detail} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <span style={{ color: COLORS.study.main }}>📝</span> 공부 기록
      </h3>
      {MOCK_STUDIES.map(s => (
        <GlassCard key={s.id} glow={COLORS.study.glow} style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setDetailId(s.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 4px", fontFamily: "'Pretendard', sans-serif" }}>{s.title}</h4>
              <p style={{ fontSize: 12, color: COLORS.dark.textMuted, margin: 0 }}>{s.goal} · {s.chapters.length}개 챕터</p>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.study.main, fontFamily: "'Outfit', sans-serif" }}>{s.progress}%</span>
          </div>
          <ProgressBar value={s.progress} color={COLORS.study.main} />
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {s.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.study.main} />)}
          </div>
        </GlassCard>
      ))}
    </div>
  );
};

/* ──────────── Page: Culture ──────────── */
const CulturePage = () => {
  const [filter, setFilter] = useState("전체");
  const filters = ["전체", "영화", "TV", "게임"];
  const filtered = filter === "전체" ? MOCK_CULTURE : MOCK_CULTURE.filter(c => c.type === filter);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        <span style={{ color: COLORS.culture.main }}>🎬</span> 문화생활
      </h3>
      {/* filter tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${filter === f ? COLORS.culture.main : COLORS.dark.border}`,
            background: filter === f ? `${COLORS.culture.main}15` : "transparent",
            color: filter === f ? COLORS.culture.main : COLORS.dark.textMuted,
            fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Pretendard', sans-serif",
          }}>{f}</button>
        ))}
      </div>
      {/* poster grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {filtered.map(c => (
          <GlassCard key={c.id} glow={COLORS.culture.glow} style={{ padding: 0, overflow: "hidden" }}>
            {/* poster placeholder */}
            <div style={{
              height: 160, background: `linear-gradient(160deg, ${COLORS.culture.main}25, ${COLORS.dark.surfaceSolid})`,
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              <FilmIcon size={36} color={`${COLORS.culture.main}55`} />
              <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={c.status} /></div>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark.text, margin: "0 0 4px", fontFamily: "'Pretendard', sans-serif" }}>{c.title}</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.dark.textMuted }}>{c.type}</span>
                {c.playtime && <span style={{ fontSize: 11, color: COLORS.culture.light }}>· {c.playtime}</span>}
              </div>
              {c.rating > 0 && <RatingStars rating={c.rating} size={12} />}
              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {c.tags.map(t => <Badge key={t} text={`#${t}`} color={COLORS.culture.main} />)}
              </div>
            </div>
          </GlassCard>
        ))}
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

  const triggerGlow = useCallback((color) => {
    setGlowEffect(color);
    setTimeout(() => setGlowEffect(null), 1200);
  }, []);

  const navItems = useMemo(() => [
    { key: "home", label: "홈", icon: <HomeIcon size={20} /> },
    { key: "reading", label: "독서", icon: <BookIcon size={20} />, color: COLORS.reading.main },
    { key: "study", label: "공부", icon: <PenIcon size={20} />, color: COLORS.study.main },
    { key: "culture", label: "문화", icon: <FilmIcon size={20} />, color: COLORS.culture.main },
  ], []);

  const renderPage = () => {
    switch (page) {
      case "reading": return <ReadingPage />;
      case "study": return <StudyPage />;
      case "culture": return <CulturePage />;
      default: return <DashboardPage onNavigate={setPage} />;
    }
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

        * { box-sizing: border-box; }
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
        padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(26,24,22,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${COLORS.dark.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* prism logo */}
          <div style={{
            width: 32, height: 32, borderRadius: 10, position: "relative", overflow: "hidden",
            background: "linear-gradient(135deg, #2db5a3, #f0c930, #e63946)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 18, height: 18, background: COLORS.dark.bg, borderRadius: 4,
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
            }} />
          </div>
          <span style={{
            fontSize: 18, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
            background: "linear-gradient(90deg, #2db5a3, #f0c930, #e63946)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "prismShimmer 3s ease-in-out infinite",
          }}>PrismLog</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <CalendarIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <TagIcon size={20} color={COLORS.dark.textMuted} />
          </button>
          {/* avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, #2db5a366, #e6394644)",
            border: `1.5px solid ${COLORS.dark.border}`,
          }} />
        </div>
      </header>

      {/* Content */}
      <main style={{
        padding: "20px 16px 120px", maxWidth: 520, margin: "0 auto",
        animation: "fadeIn 0.45s ease-out",
      }}>
        {renderPage()}
      </main>

      {/* FAB */}
      <button
        onClick={() => { setSheetOpen(true); setNewLogCat(page === "reading" || page === "study" || page === "culture" ? page : "reading"); }}
        style={{
          position: "fixed", bottom: 88, right: "calc(50% - 230px)",
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: "#2db5a3",
          boxShadow: "0 4px 16px rgba(45,181,163,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s", zIndex: 60,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <PlusIcon size={26} color="#fff" />
      </button>

      {/* Bottom Nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(26,24,22,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${COLORS.dark.border}`,
        padding: "8px 0 env(safe-area-inset-bottom, 8px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-around", maxWidth: 520, margin: "0 auto" }}>
          {navItems.map(item => {
            const active = page === item.key;
            const activeColor = item.color || "#f5f0eb";
            return (
              <button key={item.key} onClick={() => setPage(item.key)} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "6px 12px", borderRadius: 12, transition: "all 0.25s",
                position: "relative",
              }}>
                {active && <div style={{
                  position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                  width: 20, height: 3, borderRadius: 2, background: activeColor,
                  boxShadow: `0 0 8px ${activeColor}88`,
                }} />}
                <span style={{ color: active ? activeColor : COLORS.dark.textMuted, transition: "color 0.2s" }}>
                  {item.icon}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: active ? 700 : 500,
                  color: active ? activeColor : COLORS.dark.textMuted,
                  transition: "all 0.2s", fontFamily: "'Pretendard', sans-serif",
                }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Sheet for new log */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="새 기록">
        <CategorySelector selected={newLogCat} onSelect={setNewLogCat} />
        <NewLogForm category={newLogCat} />
      </BottomSheet>
    </div>
  );
}