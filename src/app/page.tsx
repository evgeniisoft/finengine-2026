'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { formatDay } from '@/lib/utils/dateFormat';

export default function Dashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState({
    start: '2026-01-01',
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?period_start=${period.start}&period_end=${period.end}`);
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyPeriod = (type: 'month' | 'quarter' | 'year') => {
    const now = new Date();
    let start = '';
    const end = now.toISOString().split('T')[0];
    
    if (type === 'month') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (type === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) * 3;
      start = `${now.getFullYear()}-${String(q + 1).padStart(2, '0')}-01`;
    } else {
      start = `${now.getFullYear()}-01-01`;
    }
    
    setPeriod({ start, end });
    setTimeout(() => loadDashboard(), 100);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  const kpi = dashboardData?.kpi || {};
  const gaps = dashboardData?.cash_gaps || [];
  const expenses = dashboardData?.expenses_by_category || [];
  const revenueByCompany = dashboardData?.revenue_by_company || [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Дашборд</h2>
          <p className="text-gray-500 mt-1">Финансовое здоровье бизнеса</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => applyPeriod('month')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Месяц</button>
          <button onClick={() => applyPeriod('quarter')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Квартал</button>
          <button onClick={() => applyPeriod('year')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Год</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Деньги на счетах</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.total_cash?.toLocaleString('ru-RU') || 0} ₽</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Выручка</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.total_revenue?.toLocaleString('ru-RU') || 0} ₽</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Прибыль</p>
          <p className={`text-2xl font-bold mt-1 ${kpi.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpi.total_profit?.toLocaleString('ru-RU') || 0} ₽
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Рентабельность</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.margin || 0}%</p>
        </div>
      </div>

      {/* Кассовые разрывы */}
      {gaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-red-700 mb-2">⚠️ Кассовые разрывы</h3>
          {gaps.slice(0, 5).map((gap: any) => (
            <div key={gap.date} className="flex justify-between text-sm text-red-600">
              <span>{formatDay(gap.date)}</span>
              <span>-{gap.deficit.toLocaleString('ru-RU')} ₽</span>
            </div>
          ))}
        </div>
      )}

      {/* Структура расходов */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Структура расходов</h3>
          <div className="space-y-3">
            {expenses.map((exp: any) => {
              const pct = kpi.total_expenses > 0 ? (exp.amount / kpi.total_expenses) * 100 : 0;
              return (
                <div key={exp.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{exp.name}</span>
                    <span className="font-medium text-gray-900">{exp.amount.toLocaleString('ru-RU')} ₽ ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Выручка по компаниям */}
      {revenueByCompany.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Выручка по компаниям</h3>
          <div className="space-y-3">
            {revenueByCompany.map((item: any) => (
              <div key={item.company.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.company.name}</span>
                <span className="font-medium text-gray-900">{item.revenue.toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}