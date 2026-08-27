import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "FinEngine 2026",
  description: "SaaS-платформа управленческого учёта",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="bg-fe-bg min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-fe-card border-r border-gray-200 fixed h-full">
            <div className="p-6 border-b border-gray-100">
              <h1 className="text-xl font-bold text-fe-text">
                FinEngine <span className="text-fe-primary">2026</span>
              </h1>
              <p className="text-xs text-fe-text-secondary mt-1">
                Управленческий учёт
              </p>
            </div>
            
            <Navigation />
          </aside>

          {/* Основной контент */}
          <main className="flex-1 ml-64 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}