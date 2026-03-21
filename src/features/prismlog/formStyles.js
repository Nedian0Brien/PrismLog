import { COLORS } from "./core";

export const FORM_LABEL_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.dark.textMuted,
  marginBottom: 6,
  display: "block",
};

export const getFormInputStyle = () => ({
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  fontSize: 16,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${COLORS.dark.border}`,
  color: COLORS.dark.text,
  outline: "none",
  fontFamily: "'Pretendard', sans-serif",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
  display: "block",
  minWidth: 0,
  WebkitAppearance: "none",
});

export const getSplitFieldStyle = (layout) => ({
  display: "grid",
  gridTemplateColumns: layout?.isTabletUp ? "repeat(2, minmax(0, 1fr))" : "1fr",
  gap: 12,
});

export const getPrimaryActionStyle = ({ accent, contrastText = "#fff", disabled = false }) => ({
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  border: "none",
  fontSize: 15,
  fontWeight: 700,
  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
  color: contrastText,
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: `0 4px 20px ${accent}44`,
  transition: "all 0.25s",
  fontFamily: "'Pretendard', sans-serif",
  opacity: disabled ? 0.7 : 1,
});

export const getDangerActionStyle = (disabled = false) => ({
  width: "100%",
  padding: "13px",
  borderRadius: 14,
  border: "1px solid rgba(230,57,70,0.5)",
  fontSize: 14,
  fontWeight: 700,
  background: "rgba(230,57,70,0.14)",
  color: "#f8b4bb",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "'Pretendard', sans-serif",
  opacity: disabled ? 0.7 : 1,
});
