export default function Loading() {
  return (
    <div style={pageStyle}>
      <div style={panelStyle} />
      <div style={panelStyle} />
      <div style={panelStyle} />
    </div>
  );
}

const pageStyle = {
  display: "grid",
  gap: 20,
} as const;

const panelStyle = {
  minHeight: 160,
  borderRadius: 20,
  border: "1px solid var(--border)",
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 37%, rgba(255,255,255,0.02) 63%)",
  backgroundSize: "400% 100%",
  animation: "pulse-shimmer 1.6s ease-in-out infinite",
} as const;
