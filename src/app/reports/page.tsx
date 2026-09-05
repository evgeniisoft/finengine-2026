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
    const [showPeriods, setShowPeriods] = useState(false);

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
    // EFFECTS
    // ============================================
    useEffect(() => {
        loadData();
    }, [activeTab, viewMode, showPeriods, periodType]);

    // ============================================
    // LOAD DATA
    // ============================================
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
                if (viewMode === 'consolidated') {
                    const monthlyUrl = `/api/reports/monthly?period_start=${period.start}&period_end=${period.end}&period_type=${periodType}&report_type=${activeTab}`;
                    const monthlyResponse = await fetch(monthlyUrl);
                    const monthlyResult = await monthlyResponse.json();
                    setMonthlyData(Array.isArray(monthlyResult.periods) ? monthlyResult.periods : []);
                } else {
                    // По компаниям — загружаем для каждой компании
                    const allMonthly: any[] = [];
                    for (const company of companiesData) {
                        const monthlyUrl = `/api/reports/monthly?company_id=${company.id}&period_start=${period.start}&period_end=${period.end}&period_type=${periodType}&report_type=${activeTab}`;
                        const monthlyResponse = await fetch(monthlyUrl);
                        const monthlyResult = await monthlyResponse.json();
                        const periods = Array.isArray(monthlyResult.periods) ? monthlyResult.periods : [];
                        allMonthly.push({ company, periods });
                    }
                    setMonthlyData(allMonthly);
                }
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
            setReports(null);
            setMonthlyData([]);
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // DRILLDOWN
    // ============================================
    const loadDrilldown = async (rowId: string, rowType?: string, companyId?: string) => {
        if (activeDrilldown === rowId && drilldownData.length > 0) {
            setActiveDrilldown(null);
            setDrilldownData([]);
            return;
        }

        try {
            setDrilldownLoading(true);
            setActiveDrilldown(rowId);

            // РАСЧЁТНЫЕ ПОКАЗАТЕЛИ — НЕТ DRILL-DOWN
            if (rowId === 'gross' || rowId === 'net' || rowId === 'profit' ||
                rowId === 'total_income' || rowId === 'total_expense' ||
                rowId === 'start' || rowId === 'end' ||
                rowId === 'total_assets' || rowId === 'total_liab' || rowId === 'equity' ||
                rowId === 'op_header' || rowId === 'inv_header' || rowId === 'fin_header' ||
                rowId === 'op_out_total' || rowId === 'assets_header' || rowId === 'liab_header' ||
                rowId === 'equity_header') {
                setDrilldownData([]);
                setDrilldownLoading(false);
                return;
            }

            let accountId = '';
            let typeParam = 'all';
            const companyParam = companyId ? `&company_id=${companyId}` : '';

            // Определяем фильтры по статье
            switch (rowId) {
                // PnL
                case 'revenue':
                    typeParam = 'income';
                    break;
                case 'cogs':
                    typeParam = 'cogs';
                    break;
                case 'opex':
                    typeParam = 'opex';
                    break;
                case 'insurance':
                    accountId = 'acc-tax-insurance';
                    typeParam = 'expense';
                    break;
                case 'ndfl':
                    accountId = 'acc-tax-ndfl';
                    typeParam = 'expense';
                    break;
                case 'depreciation':
                    accountId = 'acc-depreciation-os';
                    typeParam = 'expense';
                    break;
                case 'taxes':
                    accountId = 'acc-tax-usn';
                    typeParam = 'expense';
                    break;

                // ДДС — операционная деятельность
                case 'op_in':
                    typeParam = 'cash_in_operating';
                    break;
                case 'op_out':
                    typeParam = 'cash_out_operating';
                    break;

                // ДДС — инвестиционная деятельность
                case 'inv_in':
                    typeParam = 'cash_in_investing';
                    break;
                case 'inv_out':
                    typeParam = 'cash_out_investing';
                    break;

                // ДДС — финансовая деятельность
                case 'fin_in':
                    typeParam = 'cash_in_financing';
                    break;
                case 'fin_out':
                    typeParam = 'cash_out_financing';
                    break;

                // ДДС — остатки (расчётные — не кликабельны)
                case 'start':
                case 'end':
                    setDrilldownData([]);
                    setDrilldownLoading(false);
                    return;

                default:
                    if (rowId.startsWith('acc-')) {
                        accountId = rowId;
                        typeParam = rowType || 'all';
                    } else {
                        typeParam = rowType || 'all';
                    }
            }

            const drilldownUrl = `/api/reports/drilldown?account_id=${accountId}&type=${typeParam}&period_start=${period.start}&period_end=${period.end}${companyParam}`;
            const response = await fetch(drilldownUrl);
            const data = await response.json();

            setDrilldownData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка drill-down:', error);
        } finally {
            setDrilldownLoading(false);
        }
    };

    // ============================================
    // PERIOD PRESETS
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
                start = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`;
                end = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-${String(new Date(lm.getFullYear(), lm.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
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
                    <div className="flex gap-2">
                        <button onClick={() => applyPreset('current_month')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Текущий месяц</button>
                        <button onClick={() => applyPreset('last_month')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Прошлый месяц</button>
                        <button onClick={() => applyPreset('current_year')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Текущий год</button>
                        <button onClick={() => applyPreset('last_year')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Прошлый год</button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                        <span className="text-gray-400">—</span>
                        <input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                        <button onClick={loadData} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Применить</button>
                    </div>
                </div>
            </div>

            {/* Переключатель вида */}
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setViewMode('consolidated')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'consolidated' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                    Консолидированный
                </button>
                <button onClick={() => setViewMode('by_company')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'by_company' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
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
                            setShowPeriods(false);
                        }}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}

                {(activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={() => setShowPeriods(!showPeriods)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${showPeriods ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                            {showPeriods ? 'Скрыть по периодам' : 'По периодам'}
                        </button>
                        {showPeriods && (
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
                    {showPeriods && (activeTab === 'pnl' || activeTab === 'cashflow' || activeTab === 'balance') && (
                        <>
                            {viewMode === 'consolidated' && (
                                <MonthlyTableView
                                    data={monthlyData}
                                    type={activeTab}
                                    periodType={periodType}
                                    accounts={accounts}
                                    onDrilldown={loadDrilldown}
                                    drilldownData={drilldownData}
                                    drilldownLoading={drilldownLoading}
                                    activeDrilldown={activeDrilldown}
                                />
                            )}
                            {viewMode === 'by_company' && Array.isArray(monthlyData) && monthlyData.map((item: any) => (
                                <div key={item.company?.id || Math.random()}>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.company?.name}</h3>
                                    <MonthlyTableView
                                        data={item.periods || []}
                                        type={activeTab}
                                        periodType={periodType}
                                        accounts={accounts}
                                        onDrilldown={loadDrilldown}
                                        drilldownData={drilldownData}
                                        drilldownLoading={drilldownLoading}
                                        activeDrilldown={activeDrilldown}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {!showPeriods && (
                        <>
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
                                        <BalanceView data={reports.balance} onDrilldown={loadDrilldown} />
                                    )}
                                </div>
                            )}

                            {viewMode === 'by_company' && Array.isArray(reports) && activeTab !== 'calendar' && activeTab !== 'gaps' && reports
                                .filter((r: any, i: number, self: any[]) => self.findIndex(x => x.company?.id === r.company?.id) === i)
                                .map((report: any) => (
                                    <div key={report.company.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{report.company.name}</h3>
                                        {activeTab === 'pnl' && report.report && (
                                            <PnlView data={{ ...report.report, company_id: report.company.id }} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                        )}
                                        {activeTab === 'cashflow' && report.report && (
                                            <CashFlowView data={{ ...report.report, company_id: report.company.id }} expandedRow={expandedRow} setExpandedRow={setExpandedRow} onDrilldown={loadDrilldown} drilldownData={drilldownData} drilldownLoading={drilldownLoading} activeDrilldown={activeDrilldown} />
                                        )}
                                        {activeTab === 'balance' && report.report && (
                                            <BalanceView data={{ ...report.report, company_id: report.company.id }} onDrilldown={loadDrilldown} />
                                        )}
                                    </div>
                                ))}

                            {activeTab === 'calendar' && viewMode === 'consolidated' && (
                                <CalendarView transactions={transactions} companies={companies} companyId={null} accounts={accounts} />
                            )}
                            {activeTab === 'calendar' && viewMode === 'by_company' && companies.map((company: any) => (
                                <CalendarView key={company.id} transactions={transactions} companies={companies} companyId={company.id} accounts={accounts} />
                            ))}

                            {activeTab === 'gaps' && viewMode === 'consolidated' && (
                                <CashGapsView transactions={transactions} companies={companies} companyId={null} />
                            )}
                            {activeTab === 'gaps' && viewMode === 'by_company' && companies.map((company: any) => (
                                <CashGapsView key={company.id} transactions={transactions} companies={companies} companyId={company.id} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// PNL VIEW
// ============================================
function PnlView({ data, expandedRow, setExpandedRow, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
    const rows = [
        { id: 'revenue', label: 'Выручка', value: data.revenue, type: 'income' },
        { id: 'cogs', label: 'Себестоимость', value: data.cost_of_goods_sold, type: 'expense' },
        { id: 'gross', label: 'Валовая прибыль', value: data.gross_profit, type: 'total', bold: true },
        { id: 'opex', label: 'Операционные расходы', value: data.operating_expenses, type: 'expense' },
        { id: 'insurance', label: 'Страховые взносы', value: data.insurance_amount || 0, type: 'expense' },
        { id: 'ndfl', label: 'НДФЛ', value: data.ndfl_amount || 0, type: 'expense' },
        { id: 'depreciation', label: 'Амортизация', value: data.depreciation, type: 'expense' },
        { id: 'taxes', label: 'Налог на прибыль (УСН)', value: data.taxes, type: 'expense' },
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
                            if (onDrilldown) onDrilldown(row.id, row.type === 'expense' ? 'expense' : 'income', data.company_id);
                        }}
                    >
                        <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.green ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-gray-900'}`}>
                            {row.value?.toLocaleString('ru-RU') || 0} ₽
                        </span>
                    </div>
                    {expandedRow === row.id && (
                        <DrilldownPanel data={drilldownData} loading={drilldownLoading} active={activeDrilldown === row.id} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ============================================
// CASH FLOW VIEW
// ============================================
function CashFlowView({ data, expandedRow, setExpandedRow, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
    const rows = [
        { id: 'start', label: 'Остаток на начало', value: data.starting_balance, type: 'start' },
        { id: 'op_in', label: 'Поступления (операционные)', value: data.operating_inflow, type: 'income' },
        { id: 'op_out', label: 'Выбытия (операционные)', value: data.operating_outflow, type: 'expense' },
        { id: 'inv_in', label: 'Инвестиционные поступления', value: data.investing_inflow, type: 'income' },
        { id: 'inv_out', label: 'Инвестиционные выбытия', value: data.investing_outflow, type: 'expense' },
        { id: 'fin_in', label: 'Финансовые поступления', value: data.financing_inflow, type: 'income' },
        { id: 'fin_out', label: 'Финансовые выбытия', value: data.financing_outflow, type: 'expense' },
        { id: 'end', label: 'Остаток на конец', value: data.ending_balance, type: 'end', bold: true },
    ];

    return (
        <div className="space-y-2">
            {rows.map(row => (
                <div key={row.id}>
                    <div
                        className="flex justify-between items-center cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                        onClick={() => {
                            setExpandedRow(expandedRow === row.id ? null : row.id);
                            if (onDrilldown) onDrilldown(row.id, row.type === 'expense' ? 'expense' : row.type === 'income' ? 'income' : 'all', data.company_id);
                        }}
                    >
                        <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                        <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} ${row.type === 'income' ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-gray-900'}`}>
                            {row.value?.toLocaleString('ru-RU') || 0} ₽
                        </span>
                    </div>
                    {expandedRow === row.id && (
                        <DrilldownPanel data={drilldownData} loading={drilldownLoading} active={activeDrilldown === row.id} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ============================================
// BALANCE VIEW
// ============================================
function BalanceView({ data, onDrilldown }: any) {
    const assetRows = [
        { id: 'cash', label: 'Деньги', value: data.assets?.cash, accountId: 'acc-bank-001' },
        { id: 'ar', label: 'Дебиторская задолженность', value: data.assets?.accounts_receivable, accountId: 'acc-ar-001' },
        { id: 'inventory', label: 'Запасы', value: data.assets?.inventory, accountId: 'inventory' },
        { id: 'fa', label: 'Основные средства', value: data.assets?.fixed_assets, accountId: 'fixed_assets' },
    ];

    const liabilityRows = [
        { id: 'ap', label: 'Кредиторская задолженность', value: data.liabilities?.accounts_payable, accountId: 'acc-ap-001' },
        { id: 'loans', label: 'Кредиты', value: data.liabilities?.loans, accountId: 'acc-loan-001' },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h4 className="font-medium text-gray-700 mb-2">Активы</h4>
                {assetRows.map(row => (
                    <div key={row.id} className="flex justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 rounded"
                        onClick={() => onDrilldown && onDrilldown(row.accountId, 'all', data.company_id)}>
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
                    <div key={row.id} className="flex justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 rounded"
                        onClick={() => onDrilldown && onDrilldown(row.accountId, 'all', data.company_id)}>
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

// ============================================
// DRILLDOWN PANEL
// ============================================
function DrilldownPanel({ data, loading, active }: any) {
    if (!active) return null;

    return (
        <div className="ml-6 mt-2 p-3 bg-gray-50 rounded-lg">
            {loading ? (
                <p className="text-sm text-gray-500">Загрузка...</p>
            ) : data && data.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-auto">
                    {data.slice(0, 20).map((op: any) => (
                        <div key={op.id} className="flex justify-between text-sm">
                            <span className="text-gray-600">{formatDay(op.date)} — {op.description}</span>
                            <span className="font-medium text-gray-900">{parseFloat(op.amount)?.toLocaleString('ru-RU')} {op.currency}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-500">Нет операций по этой статье</p>
            )}
        </div>
    );
}

// ============================================
// MONTHLY TABLE VIEW
// ============================================
function MonthlyTableView({ data, type, periodType, accounts, onDrilldown, drilldownData, drilldownLoading, activeDrilldown }: any) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Нет данных за выбранный период</p>
            </div>
        );
    }

    const periods = data.map((d: any) => {
        const raw = d.period || d.month || '';
        if (periodType === 'monthly') return formatMonth(raw);
        if (periodType === 'weekly') return formatWeek(raw);
        if (periodType === 'daily') return formatDay(raw);
        if (periodType === 'quarterly') return raw;
        return raw;
    });

    const cashAccounts = accounts.filter((a: any) => a.is_cash_flow === 'true' || a.is_cash_flow === true);
    const incomeAccounts = accounts.filter((a: any) => a.type === 'I');
    const expenseAccounts = accounts.filter((a: any) => a.type === 'X');

    const getRows = () => {
        switch (type) {
            case 'pnl': {
                const rows: any[] = [];
                incomeAccounts.forEach((a: any) => rows.push({ id: a.id, label: a.name, getValue: (d: any) => d.details?.[a.id] || d.revenue || 0, color: 'text-gray-900', bold: false, rowType: 'income' }));
                rows.push({ id: 'total_income', label: 'Итого доходы', getValue: (d: any) => d.revenue || 0, color: 'text-gray-900', bold: true, rowType: 'income' });
                expenseAccounts.forEach((a: any) => rows.push({ id: a.id, label: a.name, getValue: (d: any) => d.details?.[a.id] || d.expenses || 0, color: 'text-red-600', bold: false, rowType: 'expense' }));
                rows.push({ id: 'total_expense', label: 'Итого расходы', getValue: (d: any) => d.expenses || 0, color: 'text-red-600', bold: true, rowType: 'expense' });
                rows.push({ id: 'profit', label: 'Прибыль', getValue: (d: any) => d.profit || 0, color: 'text-green-600', bold: true, rowType: 'all' });
                return rows;
            }
            case 'cashflow': {
                const rows: any[] = [];
                rows.push({ id: 'start', label: 'Остаток на начало', getValue: (d: any) => d.starting_balance || 0, color: 'text-gray-900', bold: false, rowType: 'all' });
                rows.push({ id: 'op_header', label: 'Операционная деятельность', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                rows.push({ id: 'op_in', label: '  Поступления', getValue: (d: any) => d.cash_in || 0, color: 'text-green-600', bold: false, rowType: 'income' });
                expenseAccounts.forEach((a: any) => rows.push({ id: `out_${a.id}`, label: `  ${a.name}`, getValue: (d: any) => d.details?.[a.id] || 0, color: 'text-red-600', bold: false, rowType: 'expense' }));
                rows.push({ id: 'op_out_total', label: '  Итого выбытия', getValue: (d: any) => d.cash_out || 0, color: 'text-red-600', bold: true, rowType: 'expense' });
                rows.push({ id: 'inv_header', label: 'Инвестиционная деятельность', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                rows.push({ id: 'inv_in', label: '  Поступления', getValue: (d: any) => d.investing_inflow || 0, color: 'text-green-600', bold: false, rowType: 'income' });
                rows.push({ id: 'inv_out', label: '  Выбытия', getValue: (d: any) => d.investing_outflow || 0, color: 'text-red-600', bold: false, rowType: 'expense' });
                rows.push({ id: 'fin_header', label: 'Финансовая деятельность', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                rows.push({ id: 'fin_in', label: '  Поступления', getValue: (d: any) => d.financing_inflow || 0, color: 'text-green-600', bold: false, rowType: 'income' });
                rows.push({ id: 'fin_out', label: '  Выбытия', getValue: (d: any) => d.financing_outflow || 0, color: 'text-red-600', bold: false, rowType: 'expense' });
                rows.push({ id: 'end', label: 'Остаток на конец', getValue: (d: any) => d.ending_balance || 0, color: 'text-gray-900', bold: true, rowType: 'all' });
                return rows;
            }
            case 'balance': {
                const rows: any[] = [];
                rows.push({ id: 'assets_header', label: 'АКТИВЫ', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                cashAccounts.forEach((a: any) => rows.push({ id: a.id, label: `  ${a.name}`, getValue: (d: any) => d.details?.[a.id] || 0, color: 'text-gray-900', bold: false, rowType: 'all' }));
                rows.push({ id: 'ar', label: 'Дебиторская задолженность', getValue: (d: any) => d.accounts_receivable || 0, color: 'text-gray-900', bold: false, rowType: 'all' });
                rows.push({ id: 'total_assets', label: 'Итого активы', getValue: (d: any) => d.total_assets || 0, color: 'text-gray-900', bold: true, rowType: 'all' });
                rows.push({ id: 'liab_header', label: 'ПАССИВЫ', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                rows.push({ id: 'ap', label: 'Кредиторская задолженность', getValue: (d: any) => d.accounts_payable || 0, color: 'text-red-600', bold: false, rowType: 'all' });
                rows.push({ id: 'loans', label: 'Кредиты', getValue: (d: any) => d.loans || 0, color: 'text-red-600', bold: false, rowType: 'all' });
                rows.push({ id: 'total_liab', label: 'Итого пассивы', getValue: (d: any) => d.total_liabilities || 0, color: 'text-red-600', bold: true, rowType: 'all' });
                rows.push({ id: 'equity_header', label: 'КАПИТАЛ', getValue: () => '', color: 'text-gray-900', bold: true, rowType: '' });
                rows.push({ id: 'equity', label: 'Нераспределённая прибыль', getValue: (d: any) => d.equity || 0, color: 'text-green-600', bold: true, rowType: 'all' });
                return rows;
            }
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Статья</th>
                            {periods.map((p: string, idx: number) => (
                                <th key={idx} className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{p}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {rows.map((row: any, rowIdx: number) => (
                            <tr key={rowIdx} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDrilldown && row.rowType && onDrilldown(row.id, row.rowType)}>
                                <td className={`px-4 py-3 text-sm sticky left-0 bg-white z-10 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</td>
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
                    <DrilldownPanel data={drilldownData} loading={drilldownLoading} active={true} />
                </div>
            )}
        </div>
    );
}

// ============================================
// CALENDAR VIEW
// ============================================
function CalendarView({ transactions, companies, companyId, accounts }: any) {
    const [days, setDays] = useState(30);
    const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const filteredTx = companyId ? transactions.filter((t: any) => t.company_id === companyId) : transactions;
    const companyName = companyId ? companies.find((c: any) => c.id === companyId)?.name || '' : 'Консолидированный';

    const periods = getCalendarPeriods(filteredTx, periodType, days);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{companyName} — Платёжный календарь</h3>
                <div className="flex gap-2">
                    <button onClick={() => setPeriodType('daily')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Дни</button>
                    <button onClick={() => setPeriodType('weekly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Недели</button>
                    <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Месяцы</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">Статья</th>
                            {periods.map((p: any) => (
                                <th key={p.label} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{p.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Поступления</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className="px-4 py-3 text-sm text-right text-green-600 whitespace-nowrap">{p.inflow > 0 ? '+' + p.inflow.toLocaleString('ru-RU') : ''}</td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Выбытия</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">{p.outflow > 0 ? '-' + p.outflow.toLocaleString('ru-RU') : ''}</td>
                            ))}
                        </tr>
                        <tr>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-white">Баланс</td>
                            {periods.map((p: any) => (
                                <td key={p.label} className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${p.balance < 0 ? 'text-red-600 bg-red-50' : 'text-gray-900'}`}>{p.balance.toLocaleString('ru-RU')}</td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================
// CASH GAPS VIEW
// ============================================
function CashGapsView({ transactions, companies, companyId }: any) {
    const [days, setDays] = useState(30);
    const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const filteredTx = companyId ? transactions.filter((t: any) => t.company_id === companyId) : transactions;
    const companyName = companyId ? companies.find((c: any) => c.id === companyId)?.name || '' : 'Консолидированные';

    const periods = getCalendarPeriods(filteredTx, periodType, days);
    const gapPeriods = periods.filter((p: any) => p.balance < 0);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-hidden">
            <div className="flex justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{companyName} — Кассовые разрывы</h3>
                <div className="flex gap-2">
                    <button onClick={() => setPeriodType('daily')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Дни</button>
                    <button onClick={() => setPeriodType('weekly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Недели</button>
                    <button onClick={() => setPeriodType('monthly')} className={`px-3 py-1.5 rounded-lg text-xs ${periodType === 'monthly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Месяцы</button>
                </div>
            </div>

            {gapPeriods.length === 0 ? (
                <div className="p-8 text-center">
                    <p className="text-green-600 font-medium">✅ Кассовых разрывов не прогнозируется</p>
                </div>
            ) : (
                <>
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 font-medium">⚠️ Обнаружено {gapPeriods.length} периодов с отрицательным остатком</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">Период</th>
                                    {gapPeriods.map((gap: any) => (
                                        <th key={gap.label} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{gap.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Остаток</td>
                                    {gapPeriods.map((gap: any) => (
                                        <td key={gap.label} className="px-4 py-3 text-sm text-right font-medium text-red-600 bg-red-50 whitespace-nowrap">{gap.balance.toLocaleString('ru-RU')} ₽</td>
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

// ============================================
// GET CALENDAR PERIODS
// ============================================
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