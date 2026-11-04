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

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "AI Company OS",
  description: "Internal operating platform for an AI-powered digital agency.",
  robots: { index: false, follow: false },
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { apple: `${basePath}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "AI Company OS", statusBarStyle: "default" },
};

// Content Security Policy (production builds only; dev needs eval). Scripts and styles come from this site only —
// Next's static export inlines its bootstrap scripts, hence 'unsafe-inline' — and the only other host the page may
// talk to is the Supabase project, so injected code could not send data anywhere else.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${supabase ? ` ${supabase.origin} wss://${supabase.host}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
        {process.env.NODE_ENV === "production" && <meta httpEquiv="Content-Security-Policy" content={csp} />}
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-dvh bg-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
