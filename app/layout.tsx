import type { Metadata } from "next";
import { Libre_Baskerville, Outfit } from "next/font/google";
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
    default: "MAPS Combinator | 12-Week Equity-Free Incubator in Greater Seattle",
    template: "%s | MAPS Combinator",
  },
  description:
    "MAPS Combinator is a selective, 12-week, equity-free early-stage incubator in Greater Seattle. Teams validate a real problem, build and test a useful product, and create ventures that serve their local communities.",
  openGraph: {
    siteName: "MAPS Combinator",
    title: "MAPS Combinator",
    description:
      "A 12-week, equity-free early-stage incubator building ventures that serve Greater Seattle communities.",
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
