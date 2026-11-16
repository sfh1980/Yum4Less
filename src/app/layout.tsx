import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CfWebAnalytics } from "@/components/cf-web-analytics";
import { ThemeSync } from "@/components/theme-sync";
import { readCfWebAnalyticsToken } from "@/lib/cf-web-analytics";
import "./theme-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yum4Less",
  description: "Budget-aware dinner planning built around local store pricing.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeSync />
        <CfWebAnalytics token={readCfWebAnalyticsToken()} />
        {children}
      </body>
    </html>
  );
}
