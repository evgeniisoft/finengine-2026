'use client';

import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'balance'>('pnl');
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=${activeTab}`);
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Ошибка загрузки отчётов:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'pnl', label: 'ОПиУ (P&L)' },
    { id: 'cashflow', label: 'ДДС' },
    { id: 'balance', label: 'Баланс' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Отчёты</h2>
        <p className="text-gray-500 mt-1">
          Финансовые отчёты по компаниям
        </p>
      </div>

      {/* Вкладки */}
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
          {reports?.map((report: any) => (
            <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {report.company.name}
              </h3>

              {activeTab === 'pnl' && (
                <div className="space-y-2">
                  <Row label="Выручка" value={report.report.revenue} />
                  <Row label="Себестоимость" value={report.report.cost_of_goods_sold} negative />
                  <Row label="Валовая прибыль" value={report.report.gross_profit} bold />
                  <Row label="Операционные расходы" value={report.report.operating_expenses} negative />
                  <Row label="Амортизация" value={report.report.depreciation} negative />
                  <Row label="Налоги" value={report.report.taxes} negative />
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <Row label="Чистая прибыль" value={report.report.net_profit} bold green />
                  </div>
                </div>
              )}

              {activeTab === 'cashflow' && (
                <div className="space-y-2">
                  <Row label="Остаток на начало" value={report.report.starting_balance} />
                  <Row label="Поступления (операц.)" value={report.report.operating_inflow} green />
                  <Row label="Выбытия (операц.)" value={report.report.operating_outflow} negative />
                  <Row label="Инвестиционные поступления" value={report.report.investing_inflow} green />
                  <Row label="Инвестиционные выбытия" value={report.report.investing_outflow} negative />
                  <Row label="Финансовые поступления" value={report.report.financing_inflow} green />
                  <Row label="Финансовые выбытия" value={report.report.financing_outflow} negative />
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <Row label="Остаток на конец" value={report.report.ending_balance} bold />
                  </div>
                </div>
              )}

              {activeTab === 'balance' && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Активы</h4>
                  <Row label="Деньги" value={report.report.assets.cash} />
                  <Row label="Дебиторская задолженность" value={report.report.assets.accounts_receivable} />
                  <Row label="Запасы" value={report.report.assets.inventory} />
                  <Row label="Основные средства" value={report.report.assets.fixed_assets} />
                  <Row label="Итого активы" value={report.report.assets.total} bold />
                  
                  <h4 className="font-medium text-gray-700 mt-4">Пассивы</h4>
                  <Row label="Кредиторская задолженность" value={report.report.liabilities.accounts_payable} negative />
                  <Row label="Кредиты" value={report.report.liabilities.loans} negative />
                  <Row label="Итого пассивы" value={report.report.liabilities.total} bold />
                  
                  <h4 className="font-medium text-gray-700 mt-4">Капитал</h4>
                  <Row label="Нераспределённая прибыль" value={report.report.equity.retained_earnings} bold green />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, negative, bold, green }: { 
  label: string; 
  value: number; 
  negative?: boolean;
  bold?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm ${
        bold ? 'font-bold' : 'font-medium'
      } ${
        green ? 'text-green-600' : negative ? 'text-red-600' : 'text-gray-900'
      }`}>
        {value.toLocaleString('ru-RU')} ₽
      </span>
    </div>
  );
}