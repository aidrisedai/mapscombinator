import type { Metadata } from "next";
import { Libre_Baskerville, Outfit } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const libre = Libre_Baskerville({
  variable: "--font-libre",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MAPS Center for Entrepreneurship & Innovation | Greater Seattle",
    template: "%s | MAPS Center for Entrepreneurship & Innovation",
  },
  description:
    "A home for Muslim builders in Greater Seattle. Meet collaborators, develop practical skills, build useful ventures, and strengthen the community.",
  openGraph: {
    siteName: "MAPS Center for Entrepreneurship & Innovation",
    title: "MAPS Center for Entrepreneurship & Innovation",
    description: "A home for Muslim builders in Greater Seattle.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${libre.variable} ${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-forest focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
