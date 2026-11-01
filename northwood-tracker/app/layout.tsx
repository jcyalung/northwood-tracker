import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// The whole app uses Nunito ExtraBold.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: "800",
});

export const metadata: Metadata = {
  title: "Northwood Tracker",
  description: "Student progress tracker for Code Ninjas Northwood",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
