import { Navbar } from "@/components/Navbar";

export default function Loading() {
  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle}>
        <section style={panelStyle} aria-hidden="true">
          <div style={lineStyle(240, 18)} />
          <div style={lineStyle(420, 44)} />
          <div style={lineStyle(680, 18)} />
        </section>

        <section style={panelStyle} aria-hidden="true">
          <div style={gridStyle}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} style={metricStyle} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,194,168,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,194,168,0.08), transparent 24%), var(--bg)",
} as const;

const mainStyle = {
  display: "grid",
  gap: 20,
} as const;

const panelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
  display: "grid",
  gap: 16,
} as const;

const gridStyle = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
} as const;

const metricStyle = {
  minHeight: 118,
  borderRadius: 16,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
  backgroundSize: "200% 100%",
  animation: "pulse 1.4s ease-in-out infinite",
} as const;

function lineStyle(width: number, height: number) {
  return {
    width,
    height,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
    backgroundSize: "200% 100%",
    animation: "pulse 1.4s ease-in-out infinite",
  } as const;
}
