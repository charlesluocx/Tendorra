import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tendorra",
  description:
    "Live project-activity tracking for property and construction teams: tagged emails, call notes, and action items in one shared feed per project.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
