import type { Metadata } from "next";
import "./globals.css";

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
          <aside className="w-64 bg-fe-card border-r border-gray-200 fixed h-full">
            <div className="p-6">
              <h1 className="text-xl font-bold text-fe-text">
                FinEngine <span className="text-fe-primary">2026</span>
              </h1>
              <p className="text-xs text-fe-text-secondary mt-1">
                Управленческий учёт
              </p>
            </div>
            
            <nav className="px-4 space-y-1">
              <a href="/" className="block px-4 py-2 rounded-lg text-sm font-medium bg-fe-primary text-white">
                📊 Дашборд
              </a>
              <a href="/companies" className="block px-4 py-2 rounded-lg text-sm font-medium text-fe-text-secondary hover:bg-gray-50 hover:text-fe-text">
                🏢 Компании
              </a>
              <a href="/transactions" className="block px-4 py-2 rounded-lg text-sm font-medium text-fe-text-secondary hover:bg-gray-50 hover:text-fe-text">
                💰 Операции
              </a>
              <a href="/reports" className="block px-4 py-2 rounded-lg text-sm font-medium text-fe-text-secondary hover:bg-gray-50 hover:text-fe-text">
                📈 Отчёты
              </a>
              <a href="/settings" className="block px-4 py-2 rounded-lg text-sm font-medium text-fe-text-secondary hover:bg-gray-50 hover:text-fe-text">
                ⚙️ Настройки
              </a>
            </nav>
          </aside>

          <main className="flex-1 ml-64 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}