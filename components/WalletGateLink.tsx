"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useWallet } from "@/lib/ui/WalletContext";

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

export function WalletGateLink({
  href,
  children,
  className,
  style,
  title,
}: Props) {
  const { connected } = useWallet();
  const target = connected ? href : `/wallet?next=${encodeURIComponent(href)}`;

  return (
    <Link href={target} className={className} style={style} title={title}>
      {children}
    </Link>
  );
}
