import type { Metadata, Viewport } from "next";
import { Caveat, EB_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = EB_Garamond({ variable: "--font-dc-serif", subsets: ["latin"], weight: ["500", "600"] });
const hand = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: "The Daily Canvas",
  description: "Plan a brighter, more present day.",
  appleWebApp: { capable: true, title: "Daily Canvas", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe9df" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
