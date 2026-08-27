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
      <body className="min-h-screen" style={{ backgroundColor: 'var(--color-fe-bg)' }}>
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-gray-200 fixed h-full" style={{ backgroundColor: 'var(--color-fe-card)' }}>
            <div className="p-6">
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-fe-text)' }}>
                FinEngine <span style={{ color: 'var(--color-fe-primary)' }}>2026</span>
              </h1>
              <p className="text-xs mt-1" style={{ color: 'var(--color-fe-text-secondary)' }}>
                Управленческий учёт
              </p>
            </div>
            
            <nav className="px-4 space-y-1">
              <a href="/" className="block px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-fe-primary)' }}>
                📊 Дашборд
              </a>
              <a href="/companies" className="block px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50" style={{ color: 'var(--color-fe-text-secondary)' }}>
                🏢 Компании
              </a>
              <a href="/transactions" className="block px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50" style={{ color: 'var(--color-fe-text-secondary)' }}>
                💰 Операции
              </a>
              <a href="/reports" className="block px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50" style={{ color: 'var(--color-fe-text-secondary)' }}>
                📈 Отчёты
              </a>
              <a href="/settings" className="block px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50" style={{ color: 'var(--color-fe-text-secondary)' }}>
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