import { Navbar } from "@/components/Navbar";

export default function AgentHistoryLoading() {
  return (
    <div style={pageStyle}>
      <Navbar />
      <main className="page-main" style={mainStyle} aria-busy="true" aria-live="polite">
        <section style={heroStyle}>
          <div style={heroCopyStyle}>
            <div style={skeletonEyebrowStyle} />
            <div style={skeletonTitleStyle} />
            <div style={skeletonLineStyle} />
            <div style={skeletonLineShortStyle} />
          </div>
        </section>

        <section style={panelStyle}>
          <div style={skeletonEyebrowStyle} />
          <div style={skeletonFiltersStyle} />
          <div style={skeletonCardStyle} />
          <div style={skeletonCardStyle} />
          <div style={skeletonPaginationStyle} />
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
  width: 120,
  height: 12,
} as const;

const skeletonTitleStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 340px)",
  height: 34,
} as const;

const skeletonLineStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 620px)",
  height: 14,
} as const;

const skeletonLineShortStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 480px)",
  height: 14,
} as const;

const skeletonFiltersStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 560px)",
  height: 56,
  borderRadius: 16,
} as const;

const skeletonCardStyle = {
  ...skeletonBaseStyle,
  width: "100%",
  height: 160,
  borderRadius: 18,
} as const;

const skeletonPaginationStyle = {
  ...skeletonBaseStyle,
  width: "min(100%, 220px)",
  height: 44,
  borderRadius: 12,
} as const;
