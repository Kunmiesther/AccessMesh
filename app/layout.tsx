import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { WalletProvider } from "@/lib/ui/WalletContext";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AccessMesh",
  description:
    "Pay-per-access content gateway powered by USDC nanopayments on Arc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body>
        <WalletProvider>{children}</WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}