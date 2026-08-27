'use client';

import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'balance'>('pnl');
  const [viewMode, setViewMode] = useState<'consolidated' | 'by_company'>('consolidated');
  const [period, setPeriod] = useState({
    start: '2026-01-01',
    end: '2026-12-31'
  });
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Пресеты периодов
  const periodPresets = [
    { id: 'current_month', label: 'Текущий месяц' },
    { id: 'last_month', label: 'Прошлый месяц' },
    { id: 'current_quarter', label: 'Текущий квартал' },
    { id: 'current_year', label: 'Текущий год' },
    { id: 'last_year', label: 'Прошлый год' },
    { id: 'custom', label: 'Произвольный' },
  ];

  useEffect(() => {
    loadReports();
  }, [activeTab, viewMode]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
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
      console.error('Ошибка загрузки отчётов:', error);
      setReports(viewMode === 'consolidated' ? null : []);
    } finally {
      setLoading(false);
    }
  };

  // Применение пресета периода
  const applyPreset = (presetId: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let start = '';
    let end = '';
    
    switch (presetId) {
      case 'current_month':
        start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        end = `${year}-${String(month + 1).padStart(2, '0')}-${String(
          new Date(year, month + 1, 0).getDate()
        ).padStart(2, '0')}`;
        break;
        
      case 'last_month':
        const lastMonth = new Date(year, month - 1, 1);
        const lastMonthYear = lastMonth.getFullYear();
        const lastMonthNum = lastMonth.getMonth();
        start = `${lastMonthYear}-${String(lastMonthNum + 1).padStart(2, '0')}-01`;
        end = `${lastMonthYear}-${String(lastMonthNum + 1).padStart(2, '0')}-${String(
          new Date(lastMonthYear, lastMonthNum + 1, 0).getDate()
        ).padStart(2, '0')}`;
        break;
        
      case 'current_quarter':
        const quarter = Math.floor(month / 3);
        const quarterStartMonth = quarter * 3;
        const quarterEndMonth = quarterStartMonth + 2;
        start = `${year}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
        end = `${year}-${String(quarterEndMonth + 1).padStart(2, '0')}-${String(
          new Date(year, quarterEndMonth + 1, 0).getDate()
        ).padStart(2, '0')}`;
        break;
        
      case 'current_year':
        start = `${year}-01-01`;
        end = `${year}-12-31`;
        break;
        
      case 'last_year':
        start = `${year - 1}-01-01`;
        end = `${year - 1}-12-31`;
        break;
        
      case 'custom':
        // Оставляем текущие значения
        return;
    }
    
    setPeriod({ start, end });
    setTimeout(() => loadReports(), 100);
  };

  const tabs = [
    { id: 'pnl', label: 'ОПиУ (P&L)' },
    { id: 'cashflow', label: 'ДДС (Cash Flow)' },
    { id: 'balance', label: 'Баланс' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Отчёты</h2>
        <p className="text-gray-500 mt-1">
          Финансовые отчёты холдинга
        </p>
      </div>

      {/* Панель фильтров */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Пресеты периодов */}
          <div className="flex gap-2">
            {periodPresets.map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset.id === 'custom'
                    ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Произвольный период */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={period.start}
              onChange={(e) => setPeriod({...period, start: e.target.value})}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={period.end}
              onChange={(e) => setPeriod({...period, end: e.target.value})}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={loadReports}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Применить
            </button>
          </div>
        </div>
      </div>

      {/* Переключатель вида */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setViewMode('consolidated')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'consolidated'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Консолидированный
        </button>
        <button
          onClick={() => setViewMode('by_company')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'by_company'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          По компаниям
        </button>
      </div>

      {/* Вкладки отчётов */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'consolidated' && reports && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Холдинг (консолидированный)
              </h3>

              {activeTab === 'pnl' && reports.pnl && (
                <PnlView data={reports.pnl} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}

              {activeTab === 'cashflow' && reports.cashFlow && (
                <CashFlowView data={reports.cashFlow} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}

              {activeTab === 'balance' && reports.balance && (
                <BalanceView data={reports.balance} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}
            </div>
          )}

          {viewMode === 'by_company' && Array.isArray(reports) && reports.map((report: any) => (
            <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {report.company.name}
              </h3>

              {activeTab === 'pnl' && report.report && (
                <PnlView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}

              {activeTab === 'cashflow' && report.report && (
                <CashFlowView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}

              {activeTab === 'balance' && report.report && (
                <BalanceView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PnlView({ data, expandedRow, setExpandedRow }: any) {
  const rows = [
    { id: 'revenue', label: 'Выручка', value: data.revenue, type: 'income' },
    { id: 'cogs', label: 'Себестоимость', value: data.cost_of_goods_sold, type: 'expense' },
    { id: 'gross', label: 'Валовая прибыль', value: data.gross_profit, type: 'total', bold: true },
    { id: 'opex', label: 'Операционные расходы', value: data.operating_expenses, type: 'expense' },
    { id: 'depreciation', label: 'Амортизация', value: data.depreciation, type: 'expense' },
    { id: 'taxes', label: 'Налоги', value: data.taxes, type: 'expense' },
    { id: 'net', label: 'Чистая прибыль', value: data.net_profit, type: 'total', bold: true, green: true },
  ];

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.id}>
          <div 
            className="flex justify-between items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
          >
            <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {row.label}
            </span>
            <span className={`text-sm ${
              row.bold ? 'font-bold' : 'font-medium'
            } ${
              row.green ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-gray-900'
            }`}>
              {row.value?.toLocaleString('ru-RU') || 0} ₽
            </span>
          </div>
          
          {expandedRow === row.id && (
            <div className="ml-6 mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p>Детализация по статье «{row.label}»</p>
              <p className="text-xs text-gray-400 mt-1">
                Здесь будет список операций, составляющих эту статью
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CashFlowView({ data, expandedRow, setExpandedRow }: any) {
  const rows = [
    { id: 'start', label: 'Остаток на начало', value: data.starting_balance },
    { id: 'op_in', label: 'Поступления (операционные)', value: data.operating_inflow, type: 'inflow' },
    { id: 'op_out', label: 'Выбытия (операционные)', value: data.operating_outflow, type: 'outflow' },
    { id: 'inv_in', label: 'Инвестиционные поступления', value: data.investing_inflow, type: 'inflow' },
    { id: 'inv_out', label: 'Инвестиционные выбытия', value: data.investing_outflow, type: 'outflow' },
    { id: 'fin_in', label: 'Финансовые поступления', value: data.financing_inflow, type: 'inflow' },
    { id: 'fin_out', label: 'Финансовые выбытия', value: data.financing_outflow, type: 'outflow' },
    { id: 'end', label: 'Остаток на конец', value: data.ending_balance, bold: true },
  ];

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.id}>
          <div 
            className="flex justify-between items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
          >
            <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {row.label}
            </span>
            <span className={`text-sm ${
              row.bold ? 'font-bold' : 'font-medium'
            } ${
              row.type === 'inflow' ? 'text-green-600' : 
              row.type === 'outflow' ? 'text-red-600' : 
              'text-gray-900'
            }`}>
              {row.value?.toLocaleString('ru-RU') || 0} ₽
            </span>
          </div>
          
          {expandedRow === row.id && (
            <div className="ml-6 mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p>Детализация по статье «{row.label}»</p>
              <p className="text-xs text-gray-400 mt-1">
                Здесь будет список операций по месяцам
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BalanceView({ data, expandedRow, setExpandedRow }: any) {
  const assetRows = [
    { id: 'cash', label: 'Деньги', value: data.assets?.cash },
    { id: 'ar', label: 'Дебиторская задолженность', value: data.assets?.accounts_receivable },
    { id: 'inventory', label: 'Запасы', value: data.assets?.inventory },
    { id: 'fa', label: 'Основные средства', value: data.assets?.fixed_assets },
  ];

  const liabilityRows = [
    { id: 'ap', label: 'Кредиторская задолженность', value: data.liabilities?.accounts_payable },
    { id: 'loans', label: 'Кредиты', value: data.liabilities?.loans },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-700 mb-2">Активы</h4>
        {assetRows.map(row => (
          <div key={row.id} className="flex justify-between items-center px-2 py-1">
            <span className="text-sm text-gray-600">{row.label}</span>
            <span className="text-sm font-medium text-gray-900">
              {row.value?.toLocaleString('ru-RU') || 0} ₽
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center px-2 py-1 border-t border-gray-200 mt-2">
          <span className="text-sm font-semibold text-gray-900">Итого активы</span>
          <span className="text-sm font-bold text-gray-900">
            {data.assets?.total?.toLocaleString('ru-RU') || 0} ₽
          </span>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-700 mb-2">Пассивы</h4>
        {liabilityRows.map(row => (
          <div key={row.id} className="flex justify-between items-center px-2 py-1">
            <span className="text-sm text-gray-600">{row.label}</span>
            <span className="text-sm font-medium text-red-600">
              {row.value?.toLocaleString('ru-RU') || 0} ₽
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center px-2 py-1 border-t border-gray-200 mt-2">
          <span className="text-sm font-semibold text-gray-900">Итого пассивы</span>
          <span className="text-sm font-bold text-red-600">
            {data.liabilities?.total?.toLocaleString('ru-RU') || 0} ₽
          </span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-center px-2 py-1">
          <span className="text-sm font-semibold text-gray-900">Капитал</span>
          <span className="text-sm font-bold text-green-600">
            {data.equity?.retained_earnings?.toLocaleString('ru-RU') || 0} ₽
          </span>
        </div>
      </div>
    </div>
  );
}