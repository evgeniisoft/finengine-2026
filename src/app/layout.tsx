import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "FinJir",
  description: "SaaS-платформа управленческого учёта",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-gray-200 fixed h-full shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">
                FinEngine <span className="text-blue-600">2026</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Управленческий учёт
              </p>
            </div>

            <Navigation />
          </aside>

          {/* Основной контент */}
          <main className="flex-1 ml-64 p-8 bg-gray-50 overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}