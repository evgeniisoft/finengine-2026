'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'balance' | 'calendar' | 'gaps'>('pnl');
    const [viewMode, setViewMode] = useState<'consolidated' | 'by_company'>('consolidated');
    const [period, setPeriod] = useState({
        start: '2026-01-01',
        end: '2026-12-31'
    });
    const [reports, setReports] = useState<any>(null);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [showMonthly, setShowMonthly] = useState(false);
    const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
    const [isLoadingTestData, setIsLoadingTestData] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

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
        let cancelled = false;

        const fetchData = async () => {
            await loadReports();
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [activeTab, viewMode]);

    const loadReports = async () => {
        try {
            setLoading(true);

            // Если вкладка "По месяцам" — загружаем месячные данные
            if (showMonthly) {
                const monthlyUrl = `/api/reports/monthly?period_start=${period.start}&period_end=${period.end}&period_type=${periodType}`;
                const monthlyResponse = await fetch(monthlyUrl);
                const monthlyData = await monthlyResponse.json();
                setMonthlyData(Array.isArray(monthlyData.periods) ? monthlyData.periods : []);
                setLoading(false);
                return;
            }

            if (activeTab === 'calendar' || activeTab === 'gaps') {
                const txData = await api.getAll('Transactions');
                setTransactions(Array.isArray(txData) ? txData : []);
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

            console.log('API Response:', data);
            console.log('View mode:', viewMode);
            console.log('Active tab:', activeTab);

            if (viewMode === 'consolidated') {
                setReports(data);
            } else {
                setReports(Array.isArray(data) ? data : []);
            }

        } catch (error) {
            console.error('Ошибка загрузки отчётов:', error);
            setReports(viewMode === 'consolidated' ? null : []);
            setMonthlyData([]);
        } finally {
            setLoading(false);
        }
    };
    const loadDrilldown = async (accountId: string) => {
        if (activeDrilldown === accountId) {
            setActiveDrilldown(null);
            setDrilldownData([]);
            return;
        }

        try {
            setDrilldownLoading(true);
            setActiveDrilldown(accountId);

            const url = `/api/reports/drilldown?account_id=${accountId}&period_start=${period.start}&period_end=${period.end}`;
            const response = await fetch(url);
            const data = await response.json();

            setDrilldownData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка drill-down:', error);
        } finally {
            setDrilldownLoading(false);
        }
    };

    const loadTestData = async () => {
        if (!confirm('Загрузить тестовые данные за 2026 год?')) return;

        try {
            setIsLoadingTestData(true);

            const response = await fetch('/api/test-data', {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                alert(`Загружено операций: ${result.created}`);
                loadReports();
            } else {
                alert('Ошибка: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка загрузки тестовых данных:', error);
            alert('Ошибка загрузки тестовых данных');
        } finally {
            setIsLoadingTestData(false);
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
        { id: 'calendar', label: 'Платёжный календарь' },
        { id: 'gaps', label: 'Кассовые разрывы' },
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
                {/* Кнопка загрузки тестовых данных */}
                <div className="mb-4">
                    <button
                        onClick={loadTestData}
                        disabled={isLoadingTestData}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                    >
                        {isLoadingTestData ? 'Загрузка...' : 'Загрузить тестовые данные'}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    {/* Пресеты периодов */}
                    <div className="flex gap-2">
                        {periodPresets.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyPreset(preset.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preset.id === 'custom'
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
                            onChange={(e) => setPeriod({ ...period, start: e.target.value })}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="text-gray-400">—</span>
                        <input
                            type="date"
                            value={period.end}
                            onChange={(e) => setPeriod({ ...period, end: e.target.value })}
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'consolidated'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    Консолидированный
                </button>
                <button
                    onClick={() => setViewMode('by_company')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'by_company'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    По компаниям
                </button>
            </div>

            {/* Вкладки отчётов */}
            <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setShowMonthly(false);
                            }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id && !showMonthly
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Переключатель По месяцам */}
                <button
                    onClick={() => setShowMonthly(!showMonthly)}
                    className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showMonthly
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    По месяцам
                </button>
                {/* Переключатель периода (виден только когда "По месяцам" активно) */}
                {showMonthly && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPeriodType('monthly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodType === 'monthly'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Месяцы
                        </button>
                        <button
                            onClick={() => setPeriodType('weekly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodType === 'weekly'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Недели
                        </button>
                        <button
                            onClick={() => setPeriodType('daily')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodType === 'daily'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            Дни
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
            ) : (
                <div className="space-y-6">

                    {showMonthly ? (
                        <MonthlyTableView data={monthlyData} />
                    ) : (
                        <>
                            {viewMode === 'consolidated' && reports && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        Холдинг (консолидированный)
                                    </h3>

                                    {activeTab === 'pnl' && reports.pnl && (
                                        <PnlView
                                            data={reports.pnl}
                                            expandedRow={expandedRow}
                                            setExpandedRow={setExpandedRow}
                                            onDrilldown={loadDrilldown}
                                            drilldownData={drilldownData}
                                            drilldownLoading={drilldownLoading}
                                            activeDrilldown={activeDrilldown}
                                        />
                                    )}

                                    {activeTab === 'cashflow' && reports.cashFlow && (
                                        <CashFlowView data={reports.cashFlow} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
                                    )}

                                    {activeTab === 'balance' && reports.balance && (
                                        <BalanceView data={reports.balance} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
                                    )}
                                </div>
                            )}

                            {viewMode === 'by_company' && Array.isArray(reports) && reports.filter((report: any, index: number, self: any[]) =>
                                self.findIndex(r => r.company?.id === report.company?.id) === index
                            ).map((report: any) => (
                                <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        {report.company.name}
                                    </h3>

                                    {activeTab === 'pnl' && report.report && (
                                        <PnlView
                                            data={report.report}
                                            expandedRow={expandedRow}
                                            setExpandedRow={setExpandedRow}
                                            onDrilldown={loadDrilldown}
                                            drilldownData={drilldownData}
                                            drilldownLoading={drilldownLoading}
                                            activeDrilldown={activeDrilldown}
                                        />
                                    )}

                                    {activeTab === 'cashflow' && report.report && (
                                        <CashFlowView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
                                    )}

                                    {activeTab === 'balance' && report.report && (
                                        <BalanceView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
                                    )}

                                    {activeTab === 'calendar' && (
                                        <CalendarView transactions={transactions} />
                                    )}

                                    {activeTab === 'gaps' && (
                                        <CashGapsView transactions={transactions} />
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    
                </div>
            )}
        </div>
    );
}

function PnlView({ data, expandedRow, setExpandedRow, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
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
                        onClick={() => {
                            setExpandedRow(expandedRow === row.id ? null : row.id);
                            onDrilldown(row.id);
                        }}
                    >   <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                            {row.label}
                        </span>
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'
                            } ${row.green ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-gray-900'
                            }`}>
                            {row.value?.toLocaleString('ru-RU') || 0} ₽
                        </span>
                    </div>

                    {expandedRow === row.id && (
                        <div className="ml-6 mt-2 p-3 bg-gray-50 rounded-lg">
                            {drilldownLoading && activeDrilldown === row.id ? (
                                <p className="text-sm text-gray-500">Загрузка...</p>
                            ) : drilldownData.length > 0 ? (
                                <div className="space-y-2">
                                    {drilldownData.slice(0, 10).map((op: any) => (
                                        <div key={op.id} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{op.date} — {op.description}</span>
                                            <span className="font-medium text-gray-900">
                                                {parseFloat(op.amount)?.toLocaleString('ru-RU')} {op.currency}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">Нет операций по этой статье</p>
                            )}
                        </div>
                    )}
                </div>
            ))
            }
        </div >
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
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'
                            } ${row.type === 'inflow' ? 'text-green-600' :
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
function MonthlyTableView({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                <p className="text-gray-500">Нет данных за выбранный период</p>
            </div>
        );
    }

    // Получаем список месяцев (колонки)
    const months = data.map(item => item.month);

    // Строки таблицы
    const rows = [
        { id: 'revenue', label: 'Выручка', getValue: (d: any) => d.revenue, color: 'text-gray-900' },
        { id: 'expenses', label: 'Расходы', getValue: (d: any) => d.expenses, color: 'text-red-600' },
        { id: 'profit', label: 'Прибыль', getValue: (d: any) => d.profit, color: 'text-green-600' },
        { id: 'cash_in', label: 'Поступления', getValue: (d: any) => d.cash_in, color: 'text-green-600' },
        { id: 'cash_out', label: 'Выбытия', getValue: (d: any) => d.cash_out, color: 'text-red-600' },
        { id: 'ending_balance', label: 'Остаток', getValue: (d: any) => d.ending_balance, color: 'text-gray-900' },
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">
                            Статья
                        </th>
                        {months.map(month => (
                            <th key={month} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                {month}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {rows.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                {row.label}
                            </td>
                            {data.map((monthData) => (
                                <td key={monthData.month} className={`px-4 py-3 text-sm text-right font-medium ${row.color}`}>
                                    {row.getValue(monthData)?.toLocaleString('ru-RU') || 0} ₽
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CalendarView({ transactions }: { transactions: any[] }) {
    const [days, setDays] = useState(30);

    // Группируем по датам
    const today = new Date();
    const dates = [];

    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayTransactions = transactions.filter(t => t.date === dateStr);
        const inflow = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const outflow = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        dates.push({ date: dateStr, inflow, outflow, balance: inflow - outflow });
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Платёжный календарь</h3>
                <select
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                    <option value={7}>7 дней</option>
                    <option value={14}>14 дней</option>
                    <option value={30}>30 дней</option>
                    <option value={90}>90 дней</option>
                </select>
            </div>

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Дата</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Поступления</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Выбытия</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Баланс</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {dates.map(day => (
                        <tr key={day.date} className={day.balance < 0 ? 'bg-red-50' : ''}>
                            <td className="px-4 py-3 text-sm text-gray-900">{day.date}</td>
                            <td className="px-4 py-3 text-sm text-right text-green-600">
                                {day.inflow > 0 ? '+' + day.inflow.toLocaleString('ru-RU') : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">
                                {day.outflow > 0 ? '-' + day.outflow.toLocaleString('ru-RU') : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                {day.balance.toLocaleString('ru-RU')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function CashGapsView({ transactions }: { transactions: any[] }) {
    const [days, setDays] = useState(30);

    const today = new Date();
    const gaps: any[] = [];
    let balance = 0;

    // Считаем остаток на начало (все операции до сегодня)
    const pastTransactions = transactions.filter(t => t.date < today.toISOString().split('T')[0]);
    balance = pastTransactions.reduce((sum, t) => {
        if (t.type === 'income') return sum + parseFloat(t.amount || 0);
        if (t.type === 'expense') return sum - parseFloat(t.amount || 0);
        return sum;
    }, 0);

    // Прогнозируем будущие дни
    for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayTransactions = transactions.filter(t => t.date === dateStr);
        const inflow = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const outflow = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        balance += inflow - outflow;

        if (balance < 0) {
            gaps.push({
                date: dateStr,
                deficit: Math.abs(balance),
                balance
            });
        }
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Кассовые разрывы</h3>
                <select
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                    <option value={7}>7 дней</option>
                    <option value={14}>14 дней</option>
                    <option value={30}>30 дней</option>
                    <option value={90}>90 дней</option>
                </select>
            </div>

            {gaps.length === 0 ? (
                <div className="p-8 text-center">
                    <p className="text-green-600 font-medium">✅ Кассовых разрывов не прогнозируется</p>
                </div>
            ) : (
                <>
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 font-medium">
                            ⚠️ Обнаружено {gaps.length} дн. с отрицательным остатком
                        </p>
                    </div>

                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Дата</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Дефицит</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Баланс</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {gaps.map(gap => (
                                <tr key={gap.date} className="bg-red-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{gap.date}</td>
                                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                                        -{gap.deficit.toLocaleString('ru-RU')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                                        {gap.balance.toLocaleString('ru-RU')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}