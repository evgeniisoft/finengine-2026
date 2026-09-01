'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ============================================
// ФОРМАТИРОВАНИЕ ДАТ
// ============================================
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatMonth(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-');
    return `${MONTHS_RU[parseInt(month) - 1]} ${year.substring(2)}`;
  } catch { return monthStr; }
}

function formatWeek(weekStr: string): string {
  try {
    const [year, week] = weekStr.split('-W');
    return `${parseInt(week)} нед ${year.substring(2)}`;
  } catch { return weekStr; }
}

function formatDay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    return `${day} ${MONTHS_RU[date.getMonth()]} ${String(date.getFullYear()).substring(2)}`;
  } catch { return dateStr; }
}

// ============================================
// ГЛАВНЫЙ КОМПОНЕНТ
// ============================================
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'balance' | 'calendar' | 'gaps'>('pnl');
  const [viewMode, setViewMode] = useState<'consolidated' | 'by_company'>('consolidated');
  const [showPeriods, setShowPeriods] = useState(false);
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'daily' | 'quarterly'>('monthly');
  const [period, setPeriod] = useState({ start: '2026-01-01', end: '2026-12-31' });
  
  const [reports, setReports] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const periodPresets = [
    { id: 'current_month', label: 'Текущий месяц' },
    { id: 'current_quarter', label: 'Текущий квартал' },
    { id: 'current_year', label: 'Текущий год' },
    { id: 'last_year', label: 'Прошлый год' },
  ];

  useEffect(() => {
    loadData();
  }, [activeTab, viewMode, showPeriods, periodType]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [accountsData, companiesData] = await Promise.all([
        api.getAll('Accounts'),
        api.getAll('Companies')
      ]);
      setAccounts(accountsData);
      setCompanies(companiesData);
      
      if (activeTab === 'calendar' || activeTab === 'gaps') {
        const txData = await api.getAll('Transactions');
        setTransactions(Array.isArray(txData) ? txData : []);
        setLoading(false);
        return;
      }
      
      if (showPeriods) {
        const url = `/api/reports/monthly?period_start=${period.start}&period_end=${period.end}&period_type=${periodType}`;
        const response = await fetch(url);
        const data = await response.json();
        setMonthlyData(Array.isArray(data.periods) ? data.periods : []);
        setLoading(false);
        return;
      }
      
      let url;
      if (viewMode === 'consolidated') {
        url = `/api/reports?type=consolidated&period_start=${period.start}&period_end=${period.end}`;
      } else {
        url = `/api/reports?type=${activeTab}&period_start=${period.start}&period_end=${period.end}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (viewMode === 'consolidated') {
        setReports(data);
      } else {
        setReports(Array.isArray(data) ? data : []);
      }
      
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      setReports(viewMode === 'consolidated' ? null : []);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (presetId === 'current_year') {
      setPeriod({ start: `${year}-01-01`, end: `${year}-12-31` });
    } else if (presetId === 'last_year') {
      setPeriod({ start: `${year - 1}-01-01`, end: `${year - 1}-12-31` });
    } else if (presetId === 'current_month') {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
      setPeriod({ start, end });
    } else if (presetId === 'current_quarter') {
      const q = Math.floor(month / 3) * 3;
      const start = `${year}-${String(q + 1).padStart(2, '0')}-01`;
      const end = `${year}-${String(q + 3).padStart(2, '0')}-${String(new Date(year, q + 3, 0).getDate()).padStart(2, '0')}`;
      setPeriod({ start, end });
    }
  };

  const tabs = [
    { id: 'pnl', label: 'ОПиУ' },
    { id: 'cashflow', label: 'ДДС' },
    { id: 'balance', label: 'Баланс' },
    { id: 'calendar', label: 'Платёжный календарь' },
    { id: 'gaps', label: 'Кассовые разрывы' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Отчёты</h2>
        <p className="text-gray-500 mt-1">Финансовые отчёты холдинга</p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {periodPresets.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200">
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={period.start} onChange={(e) => setPeriod({...period, start: e.target.value})}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <span className="text-gray-400">—</span>
            <input type="date" value={period.end} onChange={(e) => setPeriod({...period, end: e.target.value})}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <button onClick={loadData} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Применить
            </button>
          </div>
        </div>
      </div>

      {/* Переключатель вида */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setViewMode('consolidated')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'consolidated' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'}`}>
          Консолидированный
        </button>
        <button onClick={() => setViewMode('by_company')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'by_company' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'}`}>
          По компаниям
        </button>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setShowPeriods(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {tab.label}
          </button>
        ))}
        
        {/* Кнопка "По периодам" для ОПиУ, ДДС, Баланс */}
        {(activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
          <div className="ml-auto flex gap-2 items-center">
            <button onClick={() => setShowPeriods(!showPeriods)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${showPeriods ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {showPeriods ? 'Скрыть' : 'По периодам'}
            </button>
            
            {showPeriods && (
              <>
                {activeTab === 'pnl' && (
                  <>
                    <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Месяцы</button>
                    <button onClick={() => setPeriodType('quarterly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Кварталы</button>
                  </>
                )}
                {activeTab === 'cashflow' && (
                  <>
                    <button onClick={() => setPeriodType('daily')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Дни</button>
                    <button onClick={() => setPeriodType('weekly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Недели</button>
                    <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Месяцы</button>
                  </>
                )}
                {activeTab === 'balance' && (
                  <>
                    <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Месяцы</button>
                    <button onClick={() => setPeriodType('quarterly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Кварталы</button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Переключатель периодов для Календаря и Разрывов */}
        {(activeTab === 'calendar' || activeTab === 'gaps') && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setPeriodType('daily')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Дни</button>
            <button onClick={() => setPeriodType('weekly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Недели</button>
          </div>
        )}
      </div>

      {/* Контент */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ГОРИЗОНТАЛЬНАЯ ТАБЛИЦА ПО ПЕРИОДАМ */}
          {showPeriods && (activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
            <HorizontalPeriodTable data={monthlyData} type={activeTab} periodType={periodType} accounts={accounts} />
          )}

          {/* ОБЫЧНЫЕ ОТЧЁТЫ */}
          {!showPeriods && (
            <>
              {/* Консолидированный */}
              {viewMode === 'consolidated' && reports && (activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Холдинг (консолидированный)</h3>
                  {activeTab === 'pnl' && reports.pnl && <PnlView data={reports.pnl} />}
                  {activeTab === 'cashflow' && reports.cashFlow && <CashFlowView data={reports.cashFlow} />}
                  {activeTab === 'balance' && reports.balance && <BalanceView data={reports.balance} />}
                </div>
              )}

              {/* По компаниям */}
              {viewMode === 'by_company' && Array.isArray(reports) && reports
                .filter((r: any, i: number, self: any[]) => self.findIndex(x => x.company?.id === r.company?.id) === i)
                .map((report: any) => (
                  <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold mb-4">{report.company.name}</h3>
                    {activeTab === 'pnl' && report.report && <PnlView data={report.report} />}
                    {activeTab === 'cashflow' && report.report && <CashFlowView data={report.report} />}
                    {activeTab === 'balance' && report.report && <BalanceView data={report.report} />}
                  </div>
                ))}

              {/* Календарь */}
              {activeTab === 'calendar' && viewMode === 'consolidated' && (
                <CalendarView transactions={transactions} companyId={null} companyName="Консолидированный" />
              )}
              {activeTab === 'calendar' && viewMode === 'by_company' && companies.map((c: any) => (
                <CalendarView key={c.id} transactions={transactions} companyId={c.id} companyName={c.name} />
              ))}

              {/* Кассовые разрывы */}
              {activeTab === 'gaps' && viewMode === 'consolidated' && (
                <CashGapsView transactions={transactions} companyId={null} companyName="Консолидированные" />
              )}
              {activeTab === 'gaps' && viewMode === 'by_company' && companies.map((c: any) => (
                <CashGapsView key={c.id} transactions={transactions} companyId={c.id} companyName={c.name} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ГОРИЗОНТАЛЬНАЯ ТАБЛИЦА ПО ПЕРИОДАМ
// ============================================
function HorizontalPeriodTable({ data, type, periodType, accounts }: any) {
  if (!data || data.length === 0) {
    return <div className="bg-white rounded-xl border p-12 text-center text-gray-500">Нет данных</div>;
  }

  const periods = data.map((d: any) => {
    const raw = d.period || '';
    if (periodType === 'monthly') return formatMonth(raw);
    if (periodType === 'weekly') return formatWeek(raw);
    if (periodType === 'daily') return formatDay(raw);
    return raw;
  });

  const getRows = () => {
    switch (type) {
      case 'pnl':
        return [
          { label: 'Выручка', get: (d: any) => d.revenue, color: 'text-gray-900', bold: false },
          { label: 'Расходы', get: (d: any) => d.expenses, color: 'text-red-600', bold: false },
          { label: 'Прибыль', get: (d: any) => d.profit, color: 'text-green-600', bold: true },
        ];
      case 'cashflow':
        return [
          { label: 'Поступления', get: (d: any) => d.cash_in, color: 'text-green-600', bold: false },
          { label: 'Выбытия', get: (d: any) => d.cash_out, color: 'text-red-600', bold: false },
          { label: 'Остаток', get: (d: any) => d.ending_balance, color: 'text-gray-900', bold: true },
        ];
      case 'balance':
        return [
          { label: 'Деньги', get: (d: any) => d.cash || d.ending_balance || 0, color: 'text-gray-900', bold: false },
          { label: 'Дебиторка', get: (d: any) => d.accounts_receivable || 0, color: 'text-gray-900', bold: false },
          { label: 'Кредиторка', get: (d: any) => d.accounts_payable || 0, color: 'text-red-600', bold: false },
          { label: 'Капитал', get: (d: any) => d.equity || 0, color: 'text-green-600', bold: true },
        ];
      default:
        return [];
    }
  };

  const rows = getRows();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase sticky left-0 bg-gray-50">Статья</th>
              {periods.map((p: string, i: number) => (
                <th key={i} className="px-6 py-3 text-right text-xs font-semibold uppercase whitespace-nowrap">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className={`px-4 py-3 text-sm sticky left-0 bg-white ${row.bold ? 'font-semibold' : 'text-gray-600'}`}>{row.label}</td>
                {data.map((d: any, j: number) => (
                  <td key={j} className={`px-6 py-3 text-sm text-right whitespace-nowrap ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>
                    {row.get(d)?.toLocaleString('ru-RU') || 0} ₽
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// ОБЫЧНЫЕ ОТЧЁТЫ (ВЕРТИКАЛЬНЫЕ)
// ============================================
function PnlView({ data }: any) {
  const rows = [
    { label: 'Выручка', value: data.revenue, color: 'text-gray-900' },
    { label: 'Расходы', value: data.operating_expenses, color: 'text-red-600' },
    { label: 'Чистая прибыль', value: data.net_profit, color: 'text-green-600', bold: true },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between px-2 py-1">
          <span className={r.bold ? 'font-semibold' : 'text-gray-600'}>{r.label}</span>
          <span className={`font-medium ${r.color}`}>{r.value?.toLocaleString('ru-RU') || 0} ₽</span>
        </div>
      ))}
    </div>
  );
}

function CashFlowView({ data }: any) {
  const rows = [
    { label: 'Остаток на начало', value: data.starting_balance },
    { label: 'Поступления', value: data.operating_inflow, color: 'text-green-600' },
    { label: 'Выбытия', value: data.operating_outflow, color: 'text-red-600' },
    { label: 'Остаток на конец', value: data.ending_balance, bold: true },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between px-2 py-1">
          <span className={r.bold ? 'font-semibold' : 'text-gray-600'}>{r.label}</span>
          <span className={`font-medium ${r.color || 'text-gray-900'}`}>{r.value?.toLocaleString('ru-RU') || 0} ₽</span>
        </div>
      ))}
    </div>
  );
}

function BalanceView({ data }: any) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium mb-2">Активы</h4>
        <div className="flex justify-between px-2 py-1"><span className="text-gray-600">Деньги</span><span>{data.assets?.cash?.toLocaleString('ru-RU') || 0} ₽</span></div>
        <div className="flex justify-between px-2 py-1"><span className="text-gray-600">Дебиторка</span><span>{data.assets?.accounts_receivable?.toLocaleString('ru-RU') || 0} ₽</span></div>
        <div className="flex justify-between px-2 py-1 border-t font-semibold"><span>Итого активы</span><span>{data.assets?.total?.toLocaleString('ru-RU') || 0} ₽</span></div>
      </div>
      <div>
        <h4 className="font-medium mb-2">Пассивы</h4>
        <div className="flex justify-between px-2 py-1"><span className="text-gray-600">Кредиторка</span><span className="text-red-600">{data.liabilities?.accounts_payable?.toLocaleString('ru-RU') || 0} ₽</span></div>
        <div className="flex justify-between px-2 py-1"><span className="text-gray-600">Кредиты</span><span className="text-red-600">{data.liabilities?.loans?.toLocaleString('ru-RU') || 0} ₽</span></div>
        <div className="flex justify-between px-2 py-1"><span className="text-gray-600">Капитал</span><span className="text-green-600">{data.equity?.retained_earnings?.toLocaleString('ru-RU') || 0} ₽</span></div>
        <div className="flex justify-between px-2 py-1 border-t font-semibold"><span>Итого пассивы + капитал</span><span>{((data.liabilities?.total || 0) + (data.equity?.retained_earnings || 0)).toLocaleString('ru-RU')} ₽</span></div>
      </div>
    </div>
  );
}

// ============================================
// ПЛАТЁЖНЫЙ КАЛЕНДАРЬ (ГОРИЗОНТАЛЬНЫЙ)
// ============================================
function CalendarView({ transactions, companyId, companyName }: any) {
  const [days, setDays] = useState(30);
  
  const filteredTx = companyId ? transactions.filter((t: any) => t.company_id === companyId) : transactions;
  
  const today = new Date();
  const dates = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTx = filteredTx.filter((t: any) => t.date?.startsWith(dateStr));
    const inflow = dayTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    const outflow = dayTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    dates.push({ date: dateStr, inflow, outflow, balance: inflow - outflow });
  }
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-semibold">{companyName} — Платёжный календарь</h3>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
          <option value={7}>7 дней</option>
          <option value={14}>14 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
        </select>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase sticky left-0 bg-gray-50">Показатель</th>
              {dates.map(d => (
                <th key={d.date} className="px-4 py-3 text-right text-xs font-semibold uppercase whitespace-nowrap">
                  {formatDay(d.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-4 py-3 text-sm sticky left-0 bg-white">Поступления</td>
              {dates.map(d => (
                <td key={d.date} className="px-4 py-3 text-sm text-right text-green-600">
                  {d.inflow > 0 ? '+' + d.inflow.toLocaleString('ru-RU') : ''}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-sm sticky left-0 bg-white">Выбытия</td>
              {dates.map(d => (
                <td key={d.date} className="px-4 py-3 text-sm text-right text-red-600">
                  {d.outflow > 0 ? '-' + d.outflow.toLocaleString('ru-RU') : ''}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-sm font-semibold sticky left-0 bg-white">Баланс</td>
              {dates.map(d => (
                <td key={d.date} className={`px-4 py-3 text-sm text-right font-bold ${d.balance < 0 ? 'text-red-600 bg-red-50' : 'text-gray-900'}`}>
                  {d.balance.toLocaleString('ru-RU')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// КАССОВЫЕ РАЗРЫВЫ (ГОРИЗОНТАЛЬНЫЙ)
// ============================================
function CashGapsView({ transactions, companyId, companyName }: any) {
  const [days, setDays] = useState(30);
  
  const filteredTx = companyId ? transactions.filter((t: any) => t.company_id === companyId) : transactions;
  
  const today = new Date();
  let balance = 0;
  const dates = [];
  
  const pastTx = filteredTx.filter((t: any) => t.date < today.toISOString().split('T')[0]);
  balance = pastTx.reduce((s: number, t: any) => {
    if (t.type === 'income') return s + parseFloat(t.amount || 0);
    if (t.type === 'expense') return s - parseFloat(t.amount || 0);
    return s;
  }, 0);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTx = filteredTx.filter((t: any) => t.date?.startsWith(dateStr));
    const inflow = dayTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    const outflow = dayTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    balance += inflow - outflow;
    dates.push({ date: dateStr, balance, isGap: balance < 0 });
  }
  
  const hasGaps = dates.some(d => d.isGap);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-semibold">{companyName} — Кассовые разрывы</h3>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
          <option value={7}>7 дней</option>
          <option value={14}>14 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
        </select>
      </div>
      
      {!hasGaps ? (
        <div className="p-8 text-center text-green-600 font-medium">✅ Кассовых разрывов не прогнозируется</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase sticky left-0 bg-gray-50">Показатель</th>
                {dates.map(d => (
                  <th key={d.date} className="px-4 py-3 text-right text-xs font-semibold uppercase whitespace-nowrap">{formatDay(d.date)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-semibold sticky left-0 bg-white">Остаток</td>
                {dates.map(d => (
                  <td key={d.date} className={`px-4 py-3 text-sm text-right font-bold ${d.isGap ? 'text-red-600 bg-red-50' : 'text-gray-900'}`}>
                    {d.balance.toLocaleString('ru-RU')}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}