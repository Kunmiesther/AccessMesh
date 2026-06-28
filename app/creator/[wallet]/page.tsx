import Link from "next/link";
import { notFound } from "next/navigation";
import { WalletCopyButton } from "@/components/WalletCopyButton";
import { arcExplorerAddressUrl, formatDate, formatUSDC, shortAddress } from "@/lib/ui";
import { getCreatorProfile } from "@/services/analyticsService";

type Props = {
  params: Promise<{ wallet: string }>;
};

export default async function CreatorProfilePage({ params }: Props) {
  const { wallet } = await params;

  const profile = await getCreatorProfile(wallet).catch(() => notFound());

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 24px 80px" }}>
        <Link href="/explore" style={backLinkStyle}>
          Back to marketplace
        </Link>

        <section style={heroStyle}>
          <div style={heroCopyStyle}>
            <p style={eyebrowStyle}>Creator profile</p>
            <h1 style={titleStyle}>{profile.displayName}</h1>
            <p style={walletStyle}>{profile.wallet}</p>
            <div style={actionRowStyle}>
              <WalletCopyButton
                address={profile.wallet}
                buttonStyle={{
                  width: "auto",
                  minWidth: 132,
                  height: 36,
                  padding: "0 14px",
                }}
              />
              <a
                href={arcExplorerAddressUrl(profile.wallet)}
                target="_blank"
                rel="noreferrer"
                style={secondaryButtonStyle}
              >
                View on Arc Explorer
              </a>
            </div>
          </div>

          <div style={statsGridStyle}>
            <StatCard label="Resources" value={profile.resourcesPublished} />
            <StatCard label="Revenue" value={formatUSDC(profile.revenueEarned)} />
            <StatCard label="Unlocks" value={profile.unlockCount} />
            <StatCard label="Join date" value={formatDate(profile.joinDate)} />
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionHeader eyebrow="Top resource" title="Highest earning publication" />
          {profile.topResource ? (
            <Link href={`/resource/${profile.topResource.id}`} style={topResourceCardStyle}>
              <div style={topResourceHeaderStyle}>
                <div>
                  <p style={resourceTypeStyle}>
                    {profile.topResource.resourceCategory ?? profile.topResource.category}
                  </p>
                  <h2 style={resourceTitleStyle}>{profile.topResource.title}</h2>
                </div>
                <span style={resourcePriceStyle}>{formatUSDC(profile.topResource.priceUSDC)}</span>
              </div>
              <p style={resourceDescriptionStyle}>{profile.topResource.description}</p>
              <div style={resourceMetaGridStyle}>
                <MetaItem label="Revenue" value={formatUSDC(profile.topResource.revenue)} />
                <MetaItem label="Unlocks" value={profile.topResource.unlockCount} />
                <MetaItem label="Published" value={formatDate(profile.topResource.createdAt)} />
              </div>
            </Link>
          ) : (
            <section style={emptyStateStyle}>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                No active publications yet.
              </p>
            </section>
          )}
        </section>

        <section style={sectionStyle}>
          <SectionHeader eyebrow="Resources" title="Newest publications first" />
          {profile.resources.length > 0 ? (
            <div style={resourceGridStyle}>
              {profile.resources.map((resource) => (
                <Link key={resource.id} href={`/resource/${resource.id}`} style={resourceCardStyle}>
                  <div style={resourceCardCoverStyle}>
                    <span style={resourceTypeStyle}>
                      {resource.resourceCategory ?? resource.category}
                    </span>
                    <span style={resourcePriceStyle}>{formatUSDC(resource.priceUSDC)}</span>
                  </div>
                  <div style={resourceCardBodyStyle}>
                    <h3 style={resourceCardTitleStyle}>{resource.title}</h3>
                    <p style={resourceCardDescriptionStyle}>{resource.description}</p>
                    <div style={resourceCardMetaStyle}>
                      <MetaItem label="Revenue" value={formatUSDC(resource.revenue)} />
                      <MetaItem label="Unlocks" value={resource.unlockCount} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <section style={emptyStateStyle}>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                This creator has not published any active resources yet.
              </p>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2 style={sectionTitleStyle}>{title}</h2>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={statCardStyle}>
      <p style={metricLabelStyle}>{label}</p>
      <p style={metricValueStyle}>{value}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p style={metaLabelStyle}>{label}</p>
      <p style={metaValueStyle}>{value}</p>
    </div>
  );
}

const backLinkStyle = {
  display: "inline-block",
  color: "var(--text-secondary)",
  textDecoration: "none",
  marginBottom: 18,
  fontSize: 13,
} as const;

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
  gap: 18,
  alignItems: "stretch",
  marginBottom: 28,
} as const;

const heroCopyStyle = {
  background:
    "linear-gradient(135deg, rgba(0,194,168,0.08), rgba(255,255,255,0.02)), var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 28,
} as const;

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 12,
} as const;

const titleStyle = {
  fontSize: 36,
  lineHeight: 1.08,
  color: "var(--text-primary)",
  marginBottom: 10,
} as const;

const walletStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--text-secondary)",
  marginBottom: 18,
  wordBreak: "break-all",
} as const;

const actionRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
} as const;

const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "0 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 36,
} as const;

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 14,
} as const;

const statCardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  minWidth: 0,
} as const;

const metricLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 12,
} as const;

const metricValueStyle = {
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 600,
  color: "var(--text-primary)",
  wordBreak: "break-word",
} as const;

const sectionStyle = {
  marginBottom: 28,
} as const;

const sectionTitleStyle = {
  fontSize: 22,
  lineHeight: 1.3,
  color: "var(--text-primary)",
} as const;

const topResourceCardStyle = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 20,
  color: "inherit",
  textDecoration: "none",
} as const;

const topResourceHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "start",
  marginBottom: 12,
} as const;

const resourceTypeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
} as const;

const resourceTitleStyle = {
  fontSize: 20,
  lineHeight: 1.25,
  color: "var(--text-primary)",
} as const;

const resourcePriceStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
} as const;

const resourceDescriptionStyle = {
  fontSize: 14,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  marginBottom: 18,
} as const;

const resourceMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 12,
} as const;

const metaLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 5,
} as const;

const metaValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-secondary)",
  wordBreak: "break-word",
} as const;

const resourceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 16,
} as const;

const resourceCardStyle = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
} as const;

const resourceCardCoverStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  padding: 16,
  minHeight: 120,
  background:
    "linear-gradient(135deg, rgba(0,194,168,0.18), rgba(255,255,255,0.02))",
  borderBottom: "1px solid var(--border-subtle)",
} as const;

const resourceCardBodyStyle = {
  padding: 16,
} as const;

const resourceCardTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  color: "var(--text-primary)",
  marginBottom: 8,
} as const;

const resourceCardDescriptionStyle = {
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: 16,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;

const resourceCardMetaStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  borderTop: "1px solid var(--border-subtle)",
  paddingTop: 14,
} as const;

const emptyStateStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
} as const;
