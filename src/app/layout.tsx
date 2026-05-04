import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://altruistsehat.vercel.app'),
  title: {
    default: "Altruist Sehat | Komunitas Olahraga",
    template: "%s | Altruist Sehat"
  },
  description: "Bergabunglah dengan Altruist Sehat, komunitas olahraga yang memotivasi Anda untuk hidup lebih sehat, aktif, dan berkualitas bersama-sama.",
  keywords: ["olahraga", "kesehatan", "komunitas olahraga", "hidup sehat", "altruist sehat", "kebugaran"],
  authors: [{ name: "Altruist Sehat" }],
  creator: "Altruist Sehat",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://altruistsehat.vercel.app",
    title: "Altruist Sehat | Komunitas Olahraga",
    description: "Bergabunglah dengan Altruist Sehat, komunitas olahraga yang memotivasi Anda untuk hidup lebih sehat, aktif, dan berkualitas bersama-sama.",
    siteName: "Altruist Sehat",
    images: [{
      url: "/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Altruist Sehat"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Altruist Sehat | Komunitas Olahraga",
    description: "Bergabunglah dengan Altruist Sehat, komunitas olahraga yang memotivasi Anda untuk hidup lebih sehat, aktif, dan berkualitas bersama-sama.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: "googled288aa17e13033dc",
  }
};

import { ThemeProvider } from "@/components/ThemeContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
