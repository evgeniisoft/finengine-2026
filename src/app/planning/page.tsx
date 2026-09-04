'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PlanningPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [actualsByCategory, setActualsByCategory] = useState<{ [key: string]: { [key: string]: number } }>({});
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [totalCash, setTotalCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedScenario, setSelectedScenario] = useState<'base' | 'optimistic' | 'pessimistic'>('base');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [editingCell, setEditingCell] = useState<{ categoryId: string, month: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [viewMode, setViewMode] = useState<'plan' | 'actual' | 'deviation'>('plan');
  const [budgetType, setBudgetType] = useState<'pnl' | 'cashflow'>('pnl');

  useEffect(() => {
    loadData();
  }, [selectedCompany, selectedScenario, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, accountsData, balanceData] = await Promise.all([
        api.getAll('Companies'),
        api.getAll('Accounts'),
        fetch('/api/reports?type=balance').then(r => r.json())
      ]);

      // Считаем общий остаток денег
      const balanceArray = Array.isArray(balanceData) ? balanceData : [];
      const cash = balanceArray.reduce((sum, b) => sum + (b.report?.assets?.cash || 0), 0);
      setTotalCash(cash);
      setCompanies(companiesData);
      setAccounts(accountsData);

      const url = `/api/budget?year=${selectedYear}&scenario=${selectedScenario}${selectedCompany ? `&company_id=${selectedCompany}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      setBudgets(data.budgets || []);
      setActualsByCategory(data.actualsByCategory || {});
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFill = async () => {
    if (!selectedCompany) {
      alert('Выберите компанию');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_fill',
          companyId: selectedCompany,
          year: selectedYear
        })
      });
      const result = await response.json();

      if (result.success) {
        alert(`Создано бюджетных записей: ${result.count}`);
        loadData();
      } else {
        alert('Ошибка: ' + result.error);
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при автозаполнении');
    } finally {
      setLoading(false);
    }
  };

  const [savingCell, setSavingCell] = useState(false);

  const handleSaveCell = async () => {
    if (!editingCell) return;

    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      alert('Введите корректную сумму');
      return;
    }

    const catId = editingCell.categoryId;
    const month = editingCell.month;
    const cellData = budgetByCategory.get(catId)?.get(month);
    const budgetId = cellData?.id || '';

    try {
      setSavingCell(true);
      const response = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_cell',
          budgetId: budgetId,
          companyId: selectedCompany,
          categoryId: catId,
          period: month,
          plannedAmount: amount,
          scenario: selectedScenario
        })
      });

      const result = await response.json();

      if (result.success) {
        setEditingCell(null);
        await loadData();
      } else {
        alert('Ошибка: ' + (result.error || 'Не удалось сохранить'));
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при сохранении');
    } finally {
      setSavingCell(false);
    }
  };
  const handleCloseMonth = async () => {
    if (!selectedCompany) {
      alert('Выберите компанию');
      return;
    }

    // Определяем текущий месяц для закрытия (предыдущий от текущего)
    const now = new Date();
    const closeMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const closePeriod = `${closeMonth.getFullYear()}-${String(closeMonth.getMonth() + 1).padStart(2, '0')}`;

    if (!confirm(`Закрыть месяц ${closePeriod}? Фактические данные будут зафиксированы.`)) return;

    try {
      setLoading(true);
      const response = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_month',
          companyId: selectedCompany,
          period: closePeriod,
          scenario: selectedScenario
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Месяц ${closePeriod} закрыт. Обновлено записей: ${result.updated}`);
        loadData();
      } else {
        alert('Ошибка: ' + (result.error || 'Не удалось закрыть'));
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при закрытии месяца');
    } finally {
      setLoading(false);
    }
  };
  const groupedAccounts = () => {
    const groups = new Map<string, any[]>();
    for (const acc of accounts) {
      const group = acc.group_name || 'ПРОЧЕЕ';



      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(acc);
    }
    return groups;
  };
  const months: string[] = [];
  const monthNames: string[] = [];
  const monthNamesRu = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    monthNames.push(`${monthNamesRu[date.getMonth()]} ${String(y).substring(2)}`);
  }

  // Группируем бюджеты по статьям
  const budgetByCategory = new Map<string, Map<string, { amount: number, id: string, status: string }>>();
  for (const budget of budgets) {
    const catId = budget.category_id || budget.account_id;
    const rawPeriod = String(budget.period || '');

    let month = '';

    if (rawPeriod.includes('T')) {
      const date = new Date(rawPeriod);
      const localDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
      month = localDate.toISOString().substring(5, 7);
    } else {
      month = rawPeriod.replace(/^'/, '').substring(5, 7);
    }

    if (!budgetByCategory.has(catId)) {
      budgetByCategory.set(catId, new Map());
    }
    budgetByCategory.get(catId)!.set(rawPeriod.replace(/^'/, '').substring(0, 7), { amount: budget.planned_amount, id: budget.id, status: budget.status || 'draft' });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Планирование</h2>
          <p className="text-gray-500 mt-1">Бюджет доходов и расходов</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
            <select value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="base">Базовый</option>
              <option value="optimistic">Оптимистичный</option>
              <option value="pessimistic">Пессимистичный</option>
            </select>
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">Все компании</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={handleAutoFill}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Автозаполнить
            </button>
            <button
              onClick={handleCloseMonth}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Закрыть месяц
            </button>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setBudgetType('pnl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${budgetType === 'pnl' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              БДР (P&L)
            </button>
            <button
              onClick={() => setBudgetType('cashflow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${budgetType === 'cashflow' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              БДДС (Cash Flow)
            </button>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setViewMode('plan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewMode === 'plan' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              План
            </button>
            <button
              onClick={() => setViewMode('actual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewMode === 'actual' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              Факт
            </button>
            <button
              onClick={() => setViewMode('deviation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewMode === 'deviation' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              Отклонение
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-w-full" style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Статья</th>
                  {monthNames.map(m => <th key={m} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {budgetType === 'cashflow' && (
                  <tr className="bg-gray-100">
                    <td className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase sticky left-0 bg-gray-100">Остаток на начало</td>
                    {months.map((m, idx) => {
                      // Начальный остаток — из баланса или 0 для первого месяца
                      const balance = idx === 0 ? totalCash : 0;
                      return (
                        <td key={m} className="px-4 py-2 text-sm text-right font-bold text-gray-900">
                          {idx === 0 ? Math.round(totalCash).toLocaleString('ru-RU') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {/* Доходные статьи */}
                {Array.from(groupedAccounts().entries()).map(([groupName, groupAccounts]) => {
                  const incomeAccounts = groupAccounts.filter(a => a.type === 'I');
                  const expenseAccounts = groupAccounts.filter(a => a.type === 'X');

                  if (incomeAccounts.length === 0 && expenseAccounts.length === 0) return null;

                  return (
                    <React.Fragment key={groupName}>
                      {/* Заголовок группы */}
                      <tr className="bg-blue-50">
                        <td colSpan={13} className="px-4 py-2 text-xs font-semibold text-blue-800 uppercase bg-blue-50 whitespace-nowrap">
                          {groupName}
                        </td>
                      </tr>

                      {/* Доходы группы */}
                      {incomeAccounts.map(acc => (
                        <tr key={acc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">{acc.name}</td>
                          {months.map(m => {
                            const cellData = budgetByCategory.get(acc.id)?.get(`${m}`);
                            const amount = cellData?.amount;
                            {
                              cellData?.status === 'closed' && (
                                <div className="text-xs text-gray-500 mt-1">✓ закрыт</div>
                              )
                            }
                            return (
                              <td
                                key={m}
                                className={`px-4 py-3 text-sm text-right whitespace-nowrap ${cellData?.status === 'closed'
                                  ? 'bg-gray-100 cursor-not-allowed'
                                  : selectedCompany && viewMode === 'plan'
                                    ? 'text-gray-900 cursor-pointer hover:bg-blue-50'
                                    : 'text-gray-400'
                                  }`}
                                onClick={() => {
                                  if (viewMode !== 'plan') return;
                                  if (cellData?.status === 'closed') return;
                                  if (!selectedCompany) { alert('Выберите компанию'); return; }
                                  setEditingCell({ categoryId: acc.id, month: m });
                                  setEditValue(amount ? amount.toString() : '');
                                }}
                              >
                                {editingCell?.categoryId === acc.id && editingCell?.month === m ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCell(); if (e.key === 'Escape') setEditingCell(null); }} className="w-24 px-2 py-1 border border-blue-500 rounded text-right" autoFocus />
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveCell(); }} disabled={savingCell} className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{savingCell ? '...' : '✓'}</button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingCell(null); }} className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">✕</button>
                                  </div>
                                ) : (
                                  (() => {
                                    const actual = actualsByCategory[acc.id]?.[`${selectedYear}-${m}`] || 0;
                                    const planned = amount || 0;
                                    const dev = planned && actual ? ((actual - planned) / planned) * 100 : 0;
                                    return (
                                      <div>
                                        <div className="font-medium">{planned ? Math.round(planned).toLocaleString('ru-RU') : '—'}</div>
                                        {viewMode === 'actual' && actual > 0 && (
                                          <div className={`text-xs ${actual >= planned ? 'text-green-600' : 'text-red-600'}`}>{Math.round(actual).toLocaleString('ru-RU')}</div>
                                        )}
                                        {viewMode === 'deviation' && actual > 0 && (
                                          <div className={`text-xs ${dev >= 0 ? 'text-green-600' : 'text-red-600'}`}>{dev > 0 ? '+' : ''}{dev.toFixed(1)}%</div>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Расходы группы */}
                      {expenseAccounts.map(acc => (
                        <tr key={acc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600 sticky left-0 bg-white">{acc.name}</td>
                          {months.map(m => {
                            const cellData = budgetByCategory.get(acc.id)?.get(`${m}`);
                            const amount = cellData?.amount;
                            {
                              cellData?.status === 'closed' && (
                                <div className="text-xs text-gray-500 mt-1">✓ закрыт</div>
                              )
                            }
                            return (
                              <td
                                key={m}
                                className={`px-4 py-3 text-sm text-right whitespace-nowrap ${cellData?.status === 'closed'
                                  ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                                  : selectedCompany && viewMode === 'plan'
                                    ? 'text-red-600 cursor-pointer hover:bg-blue-50'
                                    : 'text-gray-400'
                                  }`}
                                onClick={() => {
                                  if (viewMode !== 'plan') return;
                                  if (cellData?.status === 'closed') return;
                                  if (!selectedCompany) { alert('Выберите компанию'); return; }
                                  setEditingCell({ categoryId: acc.id, month: m });
                                  setEditValue(amount ? amount.toString() : '');
                                }}
                              >
                                {editingCell?.categoryId === acc.id && editingCell?.month === m ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCell(); if (e.key === 'Escape') setEditingCell(null); }} className="w-24 px-2 py-1 border border-blue-500 rounded text-right" autoFocus />
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveCell(); }} disabled={savingCell} className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{savingCell ? '...' : '✓'}</button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingCell(null); }} className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">✕</button>
                                  </div>
                                ) : (
                                  (() => {
                                    const actual = actualsByCategory[acc.id]?.[`${selectedYear}-${m}`] || 0;
                                    const planned = amount || 0;
                                    const dev = planned && actual ? ((actual - planned) / planned) * 100 : 0;
                                    return (
                                      <div>
                                        <div className="font-medium">{planned ? Math.round(planned).toLocaleString('ru-RU') : '—'}</div>
                                        {viewMode === 'actual' && actual > 0 && (
                                          <div className={`text-xs ${actual <= planned ? 'text-green-600' : 'text-red-600'}`}>{Math.round(actual).toLocaleString('ru-RU')}</div>
                                        )}
                                        {viewMode === 'deviation' && actual > 0 && (
                                          <div className={`text-xs ${dev <= 0 ? 'text-green-600' : 'text-red-600'}`}>{dev > 0 ? '+' : ''}{dev.toFixed(1)}%</div>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Итого доходы */}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">Итого доходы</td>
                  {months.map(m => {
                    let totalPlan = 0;
                    let totalActual = 0;
                    accounts.filter(a => a.type === 'I').forEach(acc => {
                      const cellData = budgetByCategory.get(acc.id)?.get(`${m}`);
                      totalPlan += cellData?.amount || 0;
                      totalActual += actualsByCategory[acc.id]?.[`${selectedYear}-${m}`] || 0;
                    });

                    const dev = totalPlan && totalActual ? ((totalActual - totalPlan) / totalPlan) * 100 : 0;

                    return (
                      <td key={m} className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        <div>{totalPlan ? Math.round(totalPlan).toLocaleString('ru-RU') : '—'}</div>
                        {viewMode === 'actual' && totalActual > 0 && (
                          <div className={`text-xs ${totalActual >= totalPlan ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.round(totalPlan).toLocaleString('ru-RU')}
                          </div>
                        )}
                        {viewMode === 'deviation' && totalActual > 0 && (
                          <div className={`text-xs ${dev >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Итого расходы */}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">Итого расходы</td>
                  {months.map(m => {
                    let totalPlan = 0;
                    let totalActual = 0;
                    accounts.filter(a => a.type === 'X').forEach(acc => {
                      const cellData = budgetByCategory.get(acc.id)?.get(`${m}`);
                      totalPlan += cellData?.amount || 0;
                      totalActual += actualsByCategory[acc.id]?.[`${selectedYear}-${m}`] || 0;
                    });

                    const dev = totalPlan && totalActual ? ((totalActual - totalPlan) / totalPlan) * 100 : 0;

                    return (
                      <td key={m} className="px-4 py-3 text-sm text-right font-bold text-red-600">
                        <div>-{totalPlan ? Math.round(totalPlan).toLocaleString('ru-RU') : '—'}</div>
                        {viewMode === 'actual' && totalActual > 0 && (
                          <div className={`text-xs ${totalActual <= totalPlan ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.round(totalActual).toLocaleString('ru-RU')}
                          </div>
                        )}
                        {viewMode === 'deviation' && totalActual > 0 && (
                          <div className={`text-xs ${dev <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {budgetType === 'cashflow' && (
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">Операционный денежный поток</td>
                    {months.map(m => {
                      let inflow = 0;
                      let outflow = 0;

                      accounts.filter(a => a.type === 'I').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        inflow += cellData?.amount || 0;
                      });
                      accounts.filter(a => a.type === 'X').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        outflow += cellData?.amount || 0;
                      });

                      const netFlow = inflow - outflow;

                      return (
                        <td key={m} className="px-4 py-2 text-sm text-right font-bold">
                          <span className={netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {netFlow > 0 ? '+' : ''}{Math.round(netFlow).toLocaleString('ru-RU')}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {budgetType === 'pnl' && (
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-green-50">Чистая прибыль</td>
                    {months.map(m => {
                      let totalIncome = 0;
                      let totalExpense = 0;

                      accounts.filter(a => a.type === 'I').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        totalIncome += cellData?.amount || 0;
                      });
                      accounts.filter(a => a.type === 'X').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        totalExpense += cellData?.amount || 0;
                      });

                      const profit = totalIncome - totalExpense;

                      return (
                        <td key={m} className="px-4 py-3 text-sm text-right font-bold">
                          <div className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {profit > 0 ? '+' : ''}{Math.round(profit).toLocaleString('ru-RU')}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {budgetType === 'cashflow' && (
                  <tr className="bg-gray-100">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-100">Чистый денежный поток</td>
                    {months.map(m => {
                      let inflow = 0;
                      let outflow = 0;

                      accounts.filter(a => a.type === 'I').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        inflow += cellData?.amount || 0;
                      });
                      accounts.filter(a => a.type === 'X').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        outflow += cellData?.amount || 0;
                      });

                      const netFlow = inflow - outflow;

                      return (
                        <td key={m} className="px-4 py-3 text-sm text-right font-bold">
                          <span className={netFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {netFlow > 0 ? '+' : ''}{Math.round(netFlow).toLocaleString('ru-RU')}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {budgetType === 'cashflow' && (
                  <tr className="bg-blue-100">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-blue-100">Остаток на конец</td>
                    {months.map((m, idx) => {
                      let inflow = 0;
                      let outflow = 0;

                      accounts.filter(a => a.type === 'I').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        inflow += cellData?.amount || 0;
                      });
                      accounts.filter(a => a.type === 'X').forEach(acc => {
                        const cellData = budgetByCategory.get(acc.id)?.get(m);
                        outflow += cellData?.amount || 0;
                      });

                      // Кумулятивный остаток
                      const prevBalance = idx === 0 ? totalCash : 0;
                      const endingBalance = prevBalance + inflow - outflow;

                      return (
                        <td key={m} className="px-4 py-3 text-sm text-right font-bold">
                          <div className={endingBalance >= 0 ? 'text-gray-900' : 'text-red-600'}>
                            {Math.round(endingBalance).toLocaleString('ru-RU')}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {budgets.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-500">Нет бюджетных данных. Выберите компанию и нажмите "Автозаполнить".</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}