export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
export function windowDuration(start, end) {
  const mins = (new Date(end) - new Date(start)) / 60000;
  return `~${Math.round(mins)} min`;
}
export function confidenceLabel(c) {
  if (c >= 0.7) return "High";
  if (c >= 0.4) return "Marginal";
  return "Low";
}
export function stateColor(state) {
  if (state === "optimal") return "#5FF3D6";
  if (state === "marginal") return "#E6B454";
  return "#C46B6B";
}
export function stateBg(state) {
  if (state === "optimal") return "rgba(95,243,214,0.18)";
  if (state === "marginal") return "rgba(230,180,84,0.18)";
  return "rgba(196,107,107,0.18)";
}
export function stateLabel(state) {
  if (state === "optimal") return "GO";
  if (state === "marginal") return "WAIT";
  return "NO-GO";
}
export function moonPhaseEmoji(phase) {
  const map = {
    "New Moon": "🌑", "Waxing Crescent": "🌒", "First Quarter": "🌓",
    "Waxing Gibbous": "🌔", "Full Moon": "🌕", "Waning Gibbous": "🌖",
    "Last Quarter": "🌗", "Waning Crescent": "🌘",
  };
  return map[phase] || "🌕";
}
export function impactIcon(impact) {
  if (impact === "good") return "↑";
  if (impact === "bad") return "↓";
  return "—";
}
export function impactColor(impact) {
  if (impact === "good") return "#5FF3D6";
  if (impact === "bad") return "#C46B6B";
  return "rgba(180,210,220,0.55)";
}
