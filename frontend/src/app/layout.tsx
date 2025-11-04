import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import localFont from 'next/font/local';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const licorice = localFont({
  src: '../../public/fonts/Licorice-Regular.ttf',
  variable: '--font-licorice',
  weight: '400',
  style: 'normal',
  display: 'swap',
})

const rouge = localFont({
  src: '../../public/fonts/RougeScript-Regular.ttf',
  variable: '--font-rouge',
  weight: '400',
  style: 'normal',
  display: 'swap',
})

const fleurDeLeah = localFont({
  src: '../../public/fonts/FleurDeLeah-Regular.ttf',
  variable: '--font-fleur-de-leah',
  weight: '400',
  style: 'normal',
  display: 'swap',
})

// Inter variable family: include normal and italic axes so all styles resolve
const inter = localFont({
  src: [
    { path: '../../public/fonts/Inter-VariableFont_opsz,wght.ttf', weight: '100 900', style: 'normal' },
    { path: '../../public/fonts/Inter-Italic-VariableFont_opsz,wght.ttf', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
})

// Ancizar Serif variable family (normal + italic)
const ancizarSerif = localFont({
  src: [
    { path: '../../public/fonts/AncizarSerif-VariableFont_wght.ttf', weight: '100 900', style: 'normal' },
    { path: '../../public/fonts/AncizarSerif-Italic-VariableFont_wght.ttf', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-ancizar-serif',
  display: 'swap',
})

// Ancizar Sans variable family (normal + italic)
const ancizarSans = localFont({
  src: [
    { path: '../../public/fonts/AncizarSans-VariableFont_wght.ttf', weight: '100 900', style: 'normal' },
    { path: '../../public/fonts/AncizarSans-Italic-VariableFont_wght.ttf', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-ancizar-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Dupme",
  description: "Why waste 100 bytes when you can waste 1000000 bytes?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${licorice.variable} ${inter.variable} ${ancizarSerif.variable} ${ancizarSans.variable} ${fleurDeLeah.variable} ${rouge.variable} antialiased`}
      >
        {/* Early theme init to avoid FOUC between dark/light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const k='dupme_theme'; const saved=localStorage.getItem(k); const pref=saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); if (pref==='light') document.documentElement.setAttribute('data-theme','light'); else document.documentElement.removeAttribute('data-theme'); } catch {} })();`
          }}
        />
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none bg-center bg-cover"
          style={{ backgroundImage: "var(--app-bg-image)" }}
        />
        {children}
      </body>
    </html>
  );
}
