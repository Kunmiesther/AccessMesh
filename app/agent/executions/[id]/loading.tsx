import { Navbar } from "@/components/Navbar";

export default function AgentExecutionLoading() {
  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle} aria-busy="true" aria-live="polite">
        <section style={heroStyle}>
          <div style={heroCopyStyle}>
            <div style={skeletonEyebrowStyle} />
            <div style={skeletonTitleStyle} />
            <div style={skeletonLineStyle} />
          </div>
        </section>

        <section style={panelStyle}>
          <div style={skeletonSummaryStyle} />
          <div style={skeletonBlockStyle} />
          <div style={skeletonBlockStyle} />
          <div style={skeletonBlockStyle} />
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

const heroStyle = {
  display: "grid",
  gap: 18,
} as const;

const heroCopyStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.02)",
  padding: 22,
  display: "grid",
  gap: 14,
} as const;

const panelStyle = {
  borderRadius: 20,
  border: "1px solid var(--border)",
  background: "rgba(13, 15, 17, 0.96)",
  padding: 20,
  display: "grid",
  gap: 14,
} as const;

const skeletonBaseStyle = {
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
  backgroundSize: "200% 100%",
  animation: "pulse 1.4s ease-in-out infinite",
} as const;

const skeletonEyebrowStyle = {
  ...skeletonBaseStyle,
  width: 140,
  height: 12,
} as const;

const skeletonTitleStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 420px)",
  height: 32,
} as const;

const skeletonLineStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 720px)",
  height: 14,
} as const;

const skeletonSummaryStyle = {
  ...skeletonBaseStyle,
  width: "100%",
  height: 120,
  borderRadius: 18,
} as const;

const skeletonBlockStyle = {
  ...skeletonBaseStyle,
  width: "100%",
  height: 180,
  borderRadius: 18,
} as const;
