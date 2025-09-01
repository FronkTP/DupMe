import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none bg-center bg-cover"
          style={{ backgroundImage: "url('/main_background.webp')" }}
        />
        {children}
      </body>
    </html>
  );
}
