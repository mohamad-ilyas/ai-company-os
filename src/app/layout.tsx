import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import "./globals.css";

// Fonts are downloaded at build time and self-hosted — no runtime requests to Google.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Company OS",
  description: "Internal operating platform for an AI-powered digital agency.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

// Runs before first paint so language, direction, and theme never flash.
const prefsScript = `try{var p=JSON.parse(localStorage.getItem("aicos:prefs")||"{}");var l=p.locale==="ar"?"ar":"en";var t=p.theme||"system";var r=document.documentElement;r.lang=l;r.dir=l==="ar"?"rtl":"ltr";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${inter.variable} ${plexArabic.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-dvh bg-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
