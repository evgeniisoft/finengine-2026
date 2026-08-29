'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Проверяем сессию
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, reportsData] = await Promise.all([
        api.getAll('Companies'),
        fetch('/api/reports').then(r => r.json())
      ]);
      setCompanies(companiesData);
      setReports(reportsData);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Суммарные показатели
  const totalRevenue = reports.reduce((sum, r) => sum + (r.pnl?.revenue || 0), 0);
  const totalExpenses = reports.reduce((sum, r) => sum + (r.pnl?.operating_expenses || 0), 0);
  const totalProfit = totalRevenue - totalExpenses;
  const totalCash = reports.reduce((sum, r) => sum + (r.balance?.assets?.cash || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Дашборд</h2>
        <p className="text-gray-500 mt-1">
          Финансовое состояние холдинга
        </p>
      </div>

      {/* Ключевые показатели */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Выручка</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {loading ? '...' : `${totalRevenue.toLocaleString('ru-RU')} ₽`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Расходы</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {loading ? '...' : `${totalExpenses.toLocaleString('ru-RU')} ₽`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Прибыль</h3>
          <p className={`text-2xl font-bold mt-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {loading ? '...' : `${totalProfit.toLocaleString('ru-RU')} ₽`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Деньги на счетах</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {loading ? '...' : `${totalCash.toLocaleString('ru-RU')} ₽`}
          </p>
        </div>
      </div>

      {/* Отчёты по компаниям */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Компании холдинга
          </h3>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Компания
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Выручка
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Расходы
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Прибыль
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Деньги
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {report.company.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(report.pnl?.revenue || 0).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(report.pnl?.operating_expenses || 0).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <span className={report.pnl?.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {(report.pnl?.net_profit || 0).toLocaleString('ru-RU')} ₽
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {(report.balance?.assets?.cash || 0).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}