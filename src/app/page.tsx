'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/utils/dateFormat';

function getDateStr(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') return date.split('T')[0];
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return String(date).split('T')[0];
}

export default function Dashboard() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [period, setPeriod] = useState({
    start: '2026-01-01',
    end: '2026-12-31'
  });
  const [activePeriod, setActivePeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('year');
  const [periodLabel, setPeriodLabel] = useState('2026 год');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, reportsData, balanceResponse, transactionsData, accountsData] = await Promise.all([
        api.getAll('Companies'),
        fetch(`/api/reports?type=pnl&period_start=${period.start}&period_end=${period.end}`).then(r => r.json()),
        fetch('/api/reports?type=balance').then(r => r.json()),
        api.getAll('Transactions'),
        api.getAll('Accounts')
      ]);
      
      setCompanies(companiesData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setBalanceData(Array.isArray(balanceResponse) ? balanceResponse : []);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
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
    const year = now.getFullYear();
    let start = '';
    let end = '';
    let label = '';
    
    if (type === 'month') {
      const m = now.getMonth();
      start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      end = `${year}-${String(m + 1).padStart(2, '0')}-${String(new Date(year, m + 1, 0).getDate()).padStart(2, '0')}`;
      const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
      label = `${monthNames[m]} ${year}`;
    } else if (type === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = q * 3;
      const qEnd = qStart + 2;
      start = `${year}-${String(qStart + 1).padStart(2, '0')}-01`;
      end = `${year}-${String(qEnd + 1).padStart(2, '0')}-${String(new Date(year, qEnd + 1, 0).getDate()).padStart(2, '0')}`;
      label = `${q + 1} квартал ${year}`;
    } else {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
      label = `${year} год`;
    }
    
    setPeriod({ start, end });
    setActivePeriod(type);
    setPeriodLabel(label);
    setLoading(true);
    setTimeout(() => loadData(), 100);
  };

  // Суммарные показатели
  const reportsArray = Array.isArray(reports) ? reports : [];
  const balanceArray = Array.isArray(balanceData) ? balanceData : [];
  
  const totalRevenue = reportsArray.reduce((sum, r) => sum + (r.report?.revenue || 0), 0);
  const totalExpenses = reportsArray.reduce((sum, r) => sum + (r.report?.operating_expenses || 0), 0);
  const totalProfit = totalRevenue - totalExpenses;
  const totalCash = balanceArray.reduce((sum, r) => sum + (r.report?.assets?.cash || 0), 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  const totalDepreciation = reportsArray.reduce((sum, r) => sum + (r.report?.depreciation || 0), 0);
  const totalTaxes = reportsArray.reduce((sum, r) => sum + (r.report?.taxes || 0), 0);
  const ebitda = totalProfit + totalDepreciation + totalTaxes;
  
  // Run Rate
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const currentMonthStr = now.toISOString().substring(0, 7);
  const currentMonthTx = transactions.filter(t => getDateStr(t.date).startsWith(currentMonthStr));
  const currentMonthRevenue = currentMonthTx
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const dailyAverage = daysPassed > 0 ? currentMonthRevenue / daysPassed : 0;
  const runRate = dailyAverage * daysInMonth;

  // Кассовые разрывы
  const today = new Date();
  const gaps: any[] = [];
  let runningBalance = totalCash;
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayTx = transactions.filter(t => getDateStr(t.date).startsWith(dateStr));
    const inflow = dayTx.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const outflow = dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    
    runningBalance += inflow - outflow;
    
    if (runningBalance < 0) {
      gaps.push({ date: dateStr, deficit: Math.abs(runningBalance) });
    }
  }

  // Структура расходов
  const expenseAccounts = accounts.filter(a => a.type === 'X');
  const periodTx = transactions.filter(t => {
    const txDate = getDateStr(t.date);
    return txDate >= period.start && txDate <= period.end;
  });
  
  const expensesByCategory = expenseAccounts.map(a => {
    const amount = periodTx
      .filter(t => t.debit_account_id === a.id)
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    return { id: a.id, name: a.name, amount };
  }).filter(e => e.amount > 0).sort((a, b) => b.amount - a.amount);

  const sumExpensesByCategory = expensesByCategory.reduce((s, e) => s + e.amount, 0);

  // Дебиторка/кредиторка
  const totalAR = transactions.filter(t => t.debit_account_id === 'acc-ar-001').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalAP = transactions.filter(t => t.credit_account_id === 'acc-ap-001').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  
  // Алерты
  const unclassifiedTx = transactions.filter(t => 
    t.debit_account_id === 'acc-unclassified' || t.credit_account_id === 'acc-unclassified'
  );
  const unclassifiedAmount = unclassifiedTx.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-4">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Дашборд</h2>
          <p className="text-gray-500 mt-1">
            Финансовое здоровье бизнеса • {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => applyPeriod('month')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activePeriod === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Месяц
          </button>
          <button 
            onClick={() => applyPeriod('quarter')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activePeriod === 'quarter' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Квартал
          </button>
          <button 
            onClick={() => applyPeriod('year')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activePeriod === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Год
          </button>
          
          {/* Произвольный период */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={period.start}
              onChange={(e) => {
                setPeriod({ ...period, start: e.target.value });
                setActivePeriod('custom');
                setPeriodLabel(`Произвольный: ${e.target.value} — ${period.end}`);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={period.end}
              onChange={(e) => {
                setPeriod({ ...period, end: e.target.value });
                setActivePeriod('custom');
                setPeriodLabel(`Произвольный: ${period.start} — ${e.target.value}`);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
            />
            <button
              onClick={() => {
                setLoading(true);
                setTimeout(() => loadData(), 100);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {/* Первый ряд KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Деньги на счетах</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalCash.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Выручка</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalRevenue.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Прибыль</p>
          <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalProfit.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Рентабельность</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Второй ряд KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">EBITDA</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{ebitda.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Маржа</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{margin.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Run Rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{Math.round(runRate).toLocaleString('ru-RU')} ₽</p>
          <p className="text-xs text-gray-400">прогноз на месяц</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500">Расходы</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalExpenses.toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>

      {/* Кассовые разрывы */}
      {gaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-red-700 mb-2">⚠️ Кассовые разрывы (30 дней)</h3>
          {gaps.slice(0, 5).map((gap, idx) => (
            <div key={idx} className="flex justify-between text-sm text-red-600">
              <span>{formatDay(gap.date)}</span>
              <span>-{gap.deficit.toLocaleString('ru-RU')} ₽</span>
            </div>
          ))}
        </div>
      )}

      {/* Алерт-центр */}
      {(unclassifiedTx.length > 0 || totalAR > 0 || totalAP > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-yellow-700 mb-2">🔔 Требуют внимания</h3>
          {unclassifiedTx.length > 0 && (
            <p className="text-sm text-yellow-600">
              {unclassifiedTx.length} операций без категории ({unclassifiedAmount.toLocaleString('ru-RU')} ₽)
            </p>
          )}
          {totalAR > 0 && (
            <p className="text-sm text-yellow-600">
              Дебиторская задолженность: {totalAR.toLocaleString('ru-RU')} ₽
            </p>
          )}
          {totalAP > 0 && (
            <p className="text-sm text-yellow-600">
              Кредиторская задолженность: {totalAP.toLocaleString('ru-RU')} ₽
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Структура расходов */}
        {expensesByCategory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Структура расходов ({sumExpensesByCategory.toLocaleString('ru-RU')} ₽)
            </h3>
            <div className="space-y-3">
              {expensesByCategory.map(exp => {
                const pct = sumExpensesByCategory > 0 ? (exp.amount / sumExpensesByCategory) * 100 : 0;
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

        {/* Компании */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Компании холдинга</h3>
          <div className="space-y-3">
            {reportsArray.map(report => {
              const balance = balanceArray.find(b => b.company?.id === report.company?.id);
              return (
                <div key={report.company.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <p className="font-medium text-gray-900 text-sm">{report.company.name}</p>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Выручка: {(report.report?.revenue || 0).toLocaleString('ru-RU')} ₽</span>
                    <span className="text-gray-500">
                      Прибыль: <span className={report.report?.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(report.report?.net_profit || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </span>
                  </div>
                  <div className="text-sm mt-1 text-gray-500">
                    Деньги: {(balance?.report?.assets?.cash || 0).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}