import type { Metadata } from "next";
import { Oswald, Hanken_Grotesk } from "next/font/google";
import Script from "next/script";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-oswald",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Backyard Project",
  description:
    "Live table availability at The Backyard Project · bar + kitchen",
};

export default function TablesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${oswald.variable} ${hankenGrotesk.variable}`}>
      {children}
      <Script
        src="https://cdn.botpress.cloud/webchat/v3.7/inject.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://files.bpcontent.cloud/2026/08/05/13/20260805131439-DNGLV32O.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
