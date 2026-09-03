'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { hashPassword, saveSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [dbUrl, setDbUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Валидация
      if (!dbUrl) {
        setError('Введите URL базы данных');
        return;
      }
      if (!email || !password) {
        setError('Введите email и пароль');
        return;
      }
      
      // Хешируем пароль
      const passwordHash = await hashPassword(password);
      
      // Отправляем запрос
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbUrl, email, passwordHash })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.error || 'Ошибка входа');
        return;
      }
      
      // Сохраняем сессию
      if (remember) {
        saveSession({
          dbType: 'google_sheets',
          dbUrl,
          userEmail: result.user.email,
          userName: result.user.name,
          userRole: result.user.role,
          userId: result.user.id,
          companyId: result.user.company_id || ''
        });
      }
      
      // Перенаправляем на дашборд
      router.push('/');
      
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Ошибка подключения к базе данных');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            FinJir <span className="text-blue-600">2026</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Управленческий учёт
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL базы данных (GAS API)
            </label>
            <input
              type="text"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@company.ru"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="********"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mr-2 h-4 w-4"
            />
            <label className="text-sm text-gray-600">
              Запомнить на этом компьютере
            </label>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
}