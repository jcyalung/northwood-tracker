import type { Metadata } from "next";
import { Nunito, Roboto } from "next/font/google";
import "./globals.css";

// The whole app uses Nunito ExtraBold.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: "800",
});

// Required by Google's Sign-In branding guidelines for the button label.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: "500",
});

export const metadata: Metadata = {
  title: "Northwood Tracker",
  description: "Student progress tracker for Code Ninjas Northwood",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
