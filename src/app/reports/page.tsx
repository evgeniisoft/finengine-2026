'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatMonth, formatWeek, formatDay } from '@/lib/utils/dateFormat';

export default function ReportsPage() {
    // ============================================
    // STATE
    // ============================================
    const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow' | 'balance' | 'calendar' | 'gaps'>('pnl');
    const [viewMode, setViewMode] = useState<'consolidated' | 'by_company'>('consolidated');
    const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'daily' | 'quarterly'>('monthly');
    const [showMonthly, setShowMonthly] = useState(false);

    const [period, setPeriod] = useState({
        start: '2026-01-01',
        end: '2026-12-31'
    });

    // Данные
    const [reports, setReports] = useState<any>(null);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);

    // ============================================
    // PERIOD PRESETS
    // ============================================
    const periodPresets = [
        { id: 'current_month', label: 'Текущий месяц' },
        { id: 'last_month', label: 'Прошлый месяц' },
        { id: 'current_quarter', label: 'Текущий квартал' },
        { id: 'current_year', label: 'Текущий год' },
        { id: 'last_year', label: 'Прошлый год' },
    ];

    // ============================================
    // EFFECTS
    // ============================================
    useEffect(() => {
        loadData();
    }, [activeTab, viewMode, showMonthly, periodType]);

    // ============================================
    // LOAD DATA
    // ============================================
    const loadData = async () => {
        try {
            setLoading(true);

            // Загружаем справочники
            const [accountsData, companiesData] = await Promise.all([
                api.getAll('Accounts'),
                api.getAll('Companies')
            ]);
            setAccounts(accountsData);
            setCompanies(companiesData);

            // Для календаря и кассовых разрывов нужны транзакции
            if (activeTab === 'calendar' || activeTab === 'gaps') {
                const txData = await api.getAll('Transactions');
                setTransactions(Array.isArray(txData) ? txData : []);
                setLoading(false);
                return;
            }

            // Для "по месяцам" — отдельный запрос
            if (showMonthly) {
                const monthlyUrl = `/api/reports/monthly?period_start=${period.start}&period_end=${period.end}&period_type=${periodType}&report_type=${activeTab}`;
                const monthlyResponse = await fetch(monthlyUrl);
                const monthlyResult = await monthlyResponse.json();
                setMonthlyData(Array.isArray(monthlyResult.periods) ? monthlyResult.periods : []);
                setLoading(false);
                return;
            }

            // Обычные отчёты
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

    // ============================================
    // DRILLDOWN
    // ============================================
    const loadDrilldown = async (rowId: string, rowType?: string) => {
        if (activeDrilldown === rowId) {
            setActiveDrilldown(null);
            setDrilldownData([]);
            return;
        }

        try {
            setDrilldownLoading(true);
            setActiveDrilldown(rowId);

            // Для вертикальных отчётов используем тип строки (income/expense)
            const url = `/api/reports/drilldown?type=${rowType || 'all'}&period_start=${period.start}&period_end=${period.end}`;
            const response = await fetch(url);
            const data = await response.json();

            setDrilldownData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка drill-down:', error);
        } finally {
            setDrilldownLoading(false);
        }
    };

    // ============================================
    // PERIOD HANDLERS
    // ============================================
    const applyPreset = (presetId: string) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        let start = '';
        let end = '';

        switch (presetId) {
            case 'current_month':
                start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                end = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
                break;
            case 'last_month': {
                const lm = new Date(year, month - 1, 1);
                const lmYear = lm.getFullYear();
                const lmMonth = lm.getMonth();
                start = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-01`;
                end = `${lmYear}-${String(lmMonth + 1).padStart(2, '0')}-${String(new Date(lmYear, lmMonth + 1, 0).getDate()).padStart(2, '0')}`;
                break;
            }
            case 'current_quarter': {
                const q = Math.floor(month / 3);
                const qStart = q * 3;
                const qEnd = qStart + 2;
                start = `${year}-${String(qStart + 1).padStart(2, '0')}-01`;
                end = `${year}-${String(qEnd + 1).padStart(2, '0')}-${String(new Date(year, qEnd + 1, 0).getDate()).padStart(2, '0')}`;
                break;
            }
            case 'current_year':
                start = `${year}-01-01`;
                end = `${year}-12-31`;
                break;
            case 'last_year':
                start = `${year - 1}-01-01`;
                end = `${year - 1}-12-31`;
                break;
        }

        setPeriod({ start, end });
    };

    // ============================================
    // TABS
    // ============================================
    const tabs = [
        { id: 'pnl', label: 'ОПиУ (P&L)' },
        { id: 'cashflow', label: 'ДДС (Cash Flow)' },
        { id: 'balance', label: 'Баланс' },
        { id: 'calendar', label: 'Платёжный календарь' },
        { id: 'gaps', label: 'Кассовые разрывы' },
    ];

    // ============================================
    // RENDER
    // ============================================
    return (
        <div>
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Отчёты</h2>
                <p className="text-gray-500 mt-1">Финансовые отчёты холдинга</p>
            </div>

            {/* Панель фильтров */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Пресеты */}
                    <div className="flex gap-2">
                        {periodPresets.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyPreset(preset.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Даты */}
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
                            onClick={loadData}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                            Применить
                        </button>
                    </div>
                </div>
            </div>

            {/* Переключатель вида */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={() => setViewMode('consolidated')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'consolidated' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    Консолидированный
                </button>
                <button
                    onClick={() => setViewMode('by_company')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'by_company' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    По компаниям
                </button>
            </div>

            {/* Вкладки */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as any);
                            setShowMonthly(false);
                        }}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}

                {/* Переключатель периода — только для ОПиУ, ДДС, Баланс */}
                {(activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => setShowMonthly(!showMonthly)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${showMonthly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                            {showMonthly ? 'Скрыть по периодам' : 'По периодам'}
                        </button>
                        {showMonthly && (
                            <>
                                {activeTab === 'pnl' && (
                                    <>
                                        <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Месяцы</button>
                                        <button onClick={() => setPeriodType('quarterly' as any)} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Кварталы</button>
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
                                        <button onClick={() => setPeriodType('quarterly' as any)} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Кварталы</button>
                                    </>
                                )}
                            </>
                        )}
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
                    {/* === ПО МЕСЯЦАМ === */}
                    {showMonthly && (activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
                        <MonthlyTableView
                            data={monthlyData}
                            type={activeTab}
                            accounts={accounts}
                            onDrilldown={loadDrilldown}
                            drilldownData={drilldownData}
                            drilldownLoading={drilldownLoading}
                            activeDrilldown={activeDrilldown}
                        />
                    )}

                    {/* === ОБЫЧНЫЕ ОТЧЁТЫ === */}
                    {!showMonthly && (
                        <>
                            {/* Консолидированный */}
                            {viewMode === 'consolidated' && reports && activeTab !== 'calendar' && activeTab !== 'gaps' && (
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Холдинг (консолидированный)</h3>

                                    {activeTab === 'pnl' && reports.pnl && (
                                        <PnlView data={reports.pnl} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                    )}
                                    {activeTab === 'cashflow' && reports.cashFlow && (
                                        <CashFlowView data={reports.cashFlow} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                    )}
                                    {activeTab === 'balance' && reports.balance && (
                                        <BalanceView data={reports.balance} />
                                    )}
                                </div>
                            )}

                            {/* По компаниям */}
                            {viewMode === 'by_company' && Array.isArray(reports) && activeTab !== 'calendar' && activeTab !== 'gaps' && reports
                                .filter((r: any, i: number, self: any[]) => self.findIndex(x => x.company?.id === r.company?.id) === i)
                                .map((report: any) => (
                                    <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{report.company.name}</h3>

                                        {activeTab === 'pnl' && report.report && (
                                            <PnlView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                        )}
                                        {activeTab === 'cashflow' && report.report && (
                                            <CashFlowView data={report.report} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                        )}
                                        {activeTab === 'balance' && report.report && (
                                            <BalanceView data={report.report} />
                                        )}
                                    </div>
                                ))}

                            {/* Календарь */}
                            {activeTab === 'calendar' && viewMode === 'consolidated' && (
                                <CalendarView
                                    transactions={transactions}
                                    viewMode="consolidated"
                                    companies={companies}
                                    companyId={null}
                                />
                            )}

                            {activeTab === 'calendar' && viewMode === 'by_company' && companies.map((company: any) => (
                                <CalendarView
                                    key={company.id}
                                    transactions={transactions}
                                    viewMode="by_company"
                                    companies={companies}
                                    companyId={company.id}
                                />
                            ))}

                            {/* Кассовые разрывы */}
                            {activeTab === 'gaps' && viewMode === 'consolidated' && (
                                <CashGapsView
                                    transactions={transactions}
                                    viewMode="consolidated"
                                    companies={companies}
                                    companyId={null}
                                />
                            )}

                            {activeTab === 'gaps' && viewMode === 'by_company' && companies.map((company: any) => (
                                <CashGapsView
                                    key={company.id}
                                    transactions={transactions}
                                    viewMode="by_company"
                                    companies={companies}
                                    companyId={company.id}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// COMPONENTS
// ============================================

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
                            if (onDrilldown) onDrilldown(row.id, row.type === 'expense' ? 'expense' : 'income');
                        }}
                    >
                        <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.green ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-gray-900'
                            }`}>
                            {row.value?.toLocaleString('ru-RU') || 0} ₽
                        </span>
                    </div>

                    {expandedRow === row.id && (
                        <div className="ml-6 mt-2 p-3 bg-gray-50 rounded-lg">
                            {drilldownLoading && activeDrilldown === row.id ? (
                                <p className="text-sm text-gray-500">Загрузка...</p>
                            ) : drilldownData.length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-auto">
                                    {drilldownData.slice(0, 20).map((op: any) => (
                                        <div key={op.id} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{op.date} — {op.description}</span>
                                            <span className="font-medium text-gray-900">{parseFloat(op.amount)?.toLocaleString('ru-RU')} {op.currency}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">Нет операций по этой статье</p>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function CashFlowView({ data, expandedRow, setExpandedRow, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
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
                        onClick={() => {
                            setExpandedRow(expandedRow === row.id ? null : row.id);
                            if (onDrilldown) onDrilldown(row.id, row.type === 'outflow' ? 'expense' : 'income');
                        }}
                    >
                        <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.type === 'inflow' ? 'text-green-600' : row.type === 'outflow' ? 'text-red-600' : 'text-gray-900'
                            }`}>
                            {row.value?.toLocaleString('ru-RU') || 0} ₽
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function BalanceView({ data }: any) {
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
                    <div key={row.id} className="flex justify-between px-2 py-1">
                        <span className="text-sm text-gray-600">{row.label}</span>
                        <span className="text-sm font-medium text-gray-900">{row.value?.toLocaleString('ru-RU') || 0} ₽</span>
                    </div>
                ))}
                <div className="flex justify-between px-2 py-1 border-t mt-2">
                    <span className="text-sm font-semibold">Итого активы</span>
                    <span className="text-sm font-bold">{data.assets?.total?.toLocaleString('ru-RU') || 0} ₽</span>
                </div>
            </div>
            <div>
                <h4 className="font-medium text-gray-700 mb-2">Пассивы</h4>
                {liabilityRows.map(row => (
                    <div key={row.id} className="flex justify-between px-2 py-1">
                        <span className="text-sm text-gray-600">{row.label}</span>
                        <span className="text-sm font-medium text-red-600">{row.value?.toLocaleString('ru-RU') || 0} ₽</span>
                    </div>
                ))}
                <div className="flex justify-between px-2 py-1 border-t mt-2">
                    <span className="text-sm font-semibold">Итого пассивы</span>
                    <span className="text-sm font-bold text-red-600">{data.liabilities?.total?.toLocaleString('ru-RU') || 0} ₽</span>
                </div>
            </div>
            <div className="border-t pt-4">
                <div className="flex justify-between px-2 py-1">
                    <span className="text-sm text-gray-600">Капитал</span>
                    <span className="text-sm font-medium text-green-600">{data.equity?.retained_earnings?.toLocaleString('ru-RU') || 0} ₽</span>
                </div>
                <div className="flex justify-between px-2 py-1 border-t mt-2">
                    <span className="text-sm font-semibold">Итого пассивы + капитал</span>
                    <span className="text-sm font-bold text-gray-900">
                        {((data.liabilities?.total || 0) + (data.equity?.retained_earnings || 0)).toLocaleString('ru-RU')} ₽
                    </span>
                </div>
            </div>
        </div>
    );
}

function MonthlyTableView({ data, type, periodType, accounts, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Нет данных за выбранный период</p>
            </div>
        );
    }

    // Форматируем периоды
    const periods = data.map((d: any) => {
        const raw = d.period || d.month || '';
        if (periodType === 'monthly') return formatMonth(raw);
        if (periodType === 'weekly') return formatWeek(raw);
        if (periodType === 'daily') return formatDay(raw);
        return raw;
    });

    // Получаем все статьи из accounts
    const getRowsForType = () => {
        const cashAccounts = accounts.filter((a: any) =>
            a.is_cash_flow === 'true' || a.is_cash_flow === true
        );
        const incomeAccounts = accounts.filter((a: any) => a.type === 'I');
        const expenseAccounts = accounts.filter((a: any) => a.type === 'X');
        const assetAccounts = accounts.filter((a: any) => a.type === 'A');
        const liabilityAccounts = accounts.filter((a: any) => a.type === 'L');
        const equityAccounts = accounts.filter((a: any) => a.type === 'E');

        switch (type) {
            case 'pnl':
                const pnlRows: any[] = [];

                // Все доходные статьи
                incomeAccounts.forEach((a: any) => {
                    pnlRows.push({
                        id: a.id,
                        label: a.name,
                        getValue: (d: any) => d.details?.[a.id] || 0,
                        color: 'text-gray-900',
                        bold: false
                    });
                });
                pnlRows.push({ id: 'total_revenue', label: 'Итого доходы', getValue: (d: any) => d.revenue || 0, color: 'text-gray-900', bold: true });

                // Все расходные статьи
                expenseAccounts.forEach((a: any) => {
                    pnlRows.push({
                        id: a.id,
                        label: a.name,
                        getValue: (d: any) => d.details?.[a.id] || 0,
                        color: 'text-red-600',
                        bold: false
                    });
                });
                pnlRows.push({ id: 'total_expenses', label: 'Итого расходы', getValue: (d: any) => d.expenses || 0, color: 'text-red-600', bold: true });
                pnlRows.push({ id: 'profit', label: 'Прибыль', getValue: (d: any) => d.profit || 0, color: 'text-green-600', bold: true });

                return pnlRows;

            case 'cashflow':
                const cfRows: any[] = [];

                cfRows.push({ id: 'start', label: 'Остаток на начало', getValue: (d: any) => d.starting_balance || 0, color: 'text-gray-900', bold: false });

                // Операционная деятельность
                cfRows.push({ id: 'operating_header', label: 'Операционная деятельность', getValue: () => '', color: 'text-gray-900', bold: true });

                // Поступления
                cfRows.push({ id: 'op_in', label: '  Поступления', getValue: (d: any) => d.cash_in || 0, color: 'text-green-600', bold: false });

                // Выбытия по статьям
                expenseAccounts.forEach((a: any) => {
                    if (a.activity_type !== 'financing' && a.activity_type !== 'investing') {
                        cfRows.push({
                            id: `out_${a.id}`,
                            label: `  ${a.name}`,
                            getValue: (d: any) => d.details?.[a.id] || 0,
                            color: 'text-red-600',
                            bold: false
                        });
                    }
                });

                cfRows.push({ id: 'op_out_total', label: '  Итого выбытия', getValue: (d: any) => d.cash_out || 0, color: 'text-red-600', bold: true });

                // Инвестиционная деятельность
                cfRows.push({ id: 'investing_header', label: 'Инвестиционная деятельность', getValue: () => '', color: 'text-gray-900', bold: true });
                cfRows.push({ id: 'inv_in', label: '  Поступления', getValue: (d: any) => d.investing_inflow || 0, color: 'text-green-600', bold: false });
                cfRows.push({ id: 'inv_out', label: '  Выбытия', getValue: (d: any) => d.investing_outflow || 0, color: 'text-red-600', bold: false });

                // Финансовая деятельность
                cfRows.push({ id: 'financing_header', label: 'Финансовая деятельность', getValue: () => '', color: 'text-gray-900', bold: true });
                cfRows.push({ id: 'fin_in', label: '  Поступления (Кредиты, Взносы)', getValue: (d: any) => d.financing_inflow || 0, color: 'text-green-600', bold: false });
                cfRows.push({ id: 'fin_out', label: '  Выбытия (Погашение, Проценты, Дивиденды)', getValue: (d: any) => d.financing_outflow || 0, color: 'text-red-600', bold: false });

                cfRows.push({ id: 'end', label: 'Остаток на конец', getValue: (d: any) => d.ending_balance || 0, color: 'text-gray-900', bold: true });

                return cfRows;

            case 'balance':
                const balRows: any[] = [];

                // Активы
                balRows.push({ id: 'assets_header', label: 'АКТИВЫ', getValue: () => '', color: 'text-gray-900', bold: true });

                // Денежные счета
                cashAccounts.forEach((a: any) => {
                    balRows.push({
                        id: a.id,
                        label: `  ${a.name}`,
                        getValue: (d: any) => d.details?.[a.id] || 0,
                        color: 'text-gray-900',
                        bold: false
                    });
                });

                // Дебиторка
                balRows.push({ id: 'ar', label: 'Дебиторская задолженность', getValue: (d: any) => d.accounts_receivable || 0, color: 'text-gray-900', bold: false });
                balRows.push({ id: 'total_assets', label: 'Итого активы', getValue: (d: any) => d.total_assets || 0, color: 'text-gray-900', bold: true });

                // Пассивы
                balRows.push({ id: 'liabilities_header', label: 'ПАССИВЫ', getValue: () => '', color: 'text-gray-900', bold: true });
                balRows.push({ id: 'ap', label: 'Кредиторская задолженность', getValue: (d: any) => d.accounts_payable || 0, color: 'text-red-600', bold: false });
                balRows.push({ id: 'loans', label: 'Кредиты', getValue: (d: any) => d.loans || 0, color: 'text-red-600', bold: false });
                balRows.push({ id: 'total_liabilities', label: 'Итого пассивы', getValue: (d: any) => d.total_liabilities || 0, color: 'text-red-600', bold: true });

                // Капитал
                balRows.push({ id: 'equity_header', label: 'КАПИТАЛ', getValue: () => '', color: 'text-gray-900', bold: true });
                balRows.push({ id: 'retained', label: 'Нераспределённая прибыль', getValue: (d: any) => d.retained_earnings || d.equity || 0, color: 'text-green-600', bold: true });

                return balRows;

            default:
                return [];
        }
    };

    const rows = getRowsForType();

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">
                                Статья
                            </th>
                            {periods.map((p: string, idx: number) => (
                                <th key={idx} className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                                    {p}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {rows.map((row: any, rowIdx: number) => (
                            <tr
                                key={rowIdx}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => onDrilldown && onDrilldown(row.id)}
                            >
                                <td className={`px-4 py-3 text-sm sticky left-0 bg-white z-10 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                    {row.label}
                                </td>
                                {data.map((d: any, dataIdx: number) => (
                                    <td key={dataIdx} className={`px-6 py-3 text-sm text-right whitespace-nowrap ${row.bold ? 'font-bold' : 'font-medium'} ${row.color}`}>
                                        {row.getValue(d)?.toLocaleString('ru-RU') || 0} ₽
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {activeDrilldown && (
                <div className="p-4 bg-gray-50 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Детализация</h4>
                    {drilldownLoading ? (
                        <p className="text-sm text-gray-500">Загрузка...</p>
                    ) : drilldownData.length > 0 ? (
                        <div className="space-y-1 max-h-60 overflow-auto">
                            {drilldownData.slice(0, 20).map((op: any) => (
                                <div key={op.id} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{formatDay(op.date)} — {op.description}</span>
                                    <span className="font-medium">{parseFloat(op.amount)?.toLocaleString('ru-RU')} ₽</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Нет операций</p>
                    )}
                </div>
            )}
        </div>
    );
}



function CalendarView({ transactions, viewMode, companies, companyId }: any) {
    const [days, setDays] = useState(30);
    const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const filteredTx = companyId
        ? transactions.filter((t: any) => t.company_id === companyId)
        : transactions;

    const companyName = companyId
        ? companies.find((c: any) => c.id === companyId)?.name || ''
        : 'Консолидированный';

    // Получаем периоды
    const periods = getCalendarPeriods(filteredTx, periodType, days);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    {companyName} — Платёжный календарь
                </h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPeriodType('daily')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Дни
                    </button>
                    <button 
                        onClick={() => setPeriodType('weekly')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Недели
                    </button>
                    <button 
                        onClick={() => setPeriodType('monthly')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Месяцы
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">
                                Статья
                            </th>
                            {periods.map((p: any) => (
                                <th key={p.label} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                                    {p.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Поступления</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className="px-4 py-3 text-sm text-right text-green-600 whitespace-nowrap">
                                    {p.inflow > 0 ? '+' + p.inflow.toLocaleString('ru-RU') : ''}
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Выбытия</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
                                    {p.outflow > 0 ? '-' + p.outflow.toLocaleString('ru-RU') : ''}
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-white">Баланс</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${p.balance < 0 ? 'text-red-600 bg-red-50' : 'text-gray-900'}`}>
                                    {p.balance.toLocaleString('ru-RU')}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CashGapsView({ transactions, viewMode, companies, companyId }: any) {
    const [days, setDays] = useState(30);
    const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const filteredTx = companyId
        ? transactions.filter((t: any) => t.company_id === companyId)
        : transactions;

    const companyName = companyId
        ? companies.find((c: any) => c.id === companyId)?.name || ''
        : 'Консолидированные';

    // Получаем периоды
    const periods = getCalendarPeriods(filteredTx, periodType, days);
    
    // Находим периоды с отрицательным балансом
    const gapPeriods = periods.filter((p: any) => p.balance < 0);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    {companyName} — Кассовые разрывы
                </h3>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setPeriodType('daily')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Дни
                    </button>
                    <button 
                        onClick={() => setPeriodType('weekly')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Недели
                    </button>
                    <button 
                        onClick={() => setPeriodType('monthly')} 
                        className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                        Месяцы
                    </button>
                </div>
            </div>

            {gapPeriods.length === 0 ? (
                <div className="p-8 text-center">
                    <p className="text-green-600 font-medium">✅ Кассовых разрывов не прогнозируется</p>
                </div>
            ) : (
                <>
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 font-medium">
                            ⚠️ Обнаружено {gapPeriods.length} периодов с отрицательным остатком
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">
                                        Период
                                    </th>
                                    {gapPeriods.map((gap: any) => (
                                        <th key={gap.label} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                                            {gap.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                        Остаток
                                    </td>
                                    {gapPeriods.map((gap: any) => (
                                        <td key={gap.label} className="px-4 py-3 text-sm text-right font-medium text-red-600 bg-red-50 whitespace-nowrap">
                                            {gap.balance.toLocaleString('ru-RU')} ₽
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
function getCalendarPeriods(transactions: any[], periodType: string, count: number): any[] {
    const today = new Date();
    const periods: any[] = [];
    
    for (let i = 0; i < count; i++) {
        const date = new Date(today);
        
        if (periodType === 'daily') {
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayTx = transactions.filter((t: any) => t.date?.startsWith(dateStr));
            const inflow = dayTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            const outflow = dayTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            periods.push({ label: formatDay(dateStr), inflow, outflow, balance: inflow - outflow });
        } else if (periodType === 'weekly') {
            date.setDate(date.getDate() + i * 7);
            const weekStart = date.toISOString().split('T')[0];
            const weekEnd = new Date(date);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekEndStr = weekEnd.toISOString().split('T')[0];
            const weekTx = transactions.filter((t: any) => {
                const txDate = t.date?.split('T')[0] || t.date;
                return txDate >= weekStart && txDate <= weekEndStr;
            });
            const inflow = weekTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            const outflow = weekTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            periods.push({ label: `${i + 1} нед`, inflow, outflow, balance: inflow - outflow });
        } else if (periodType === 'monthly') {
            date.setMonth(date.getMonth() + i);
            const monthStr = date.toISOString().substring(0, 7);
            const monthTx = transactions.filter((t: any) => t.date?.startsWith(monthStr));
            const inflow = monthTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            const outflow = monthTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            periods.push({ label: formatMonth(monthStr), inflow, outflow, balance: inflow - outflow });
        }
    }
    
    return periods;
}