'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PlanningPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedScenario, setSelectedScenario] = useState<'base' | 'optimistic' | 'pessimistic'>('base');
  const [selectedYear, setSelectedYear] = useState('2026');

  useEffect(() => {
    loadData();
  }, [selectedCompany, selectedScenario, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, accountsData] = await Promise.all([
        api.getAll('Companies'),
        api.getAll('Accounts')
      ]);
      setCompanies(companiesData);
      setAccounts(accountsData);
      
      const url = `/api/budget?year=${selectedYear}&scenario=${selectedScenario}${selectedCompany ? `&company_id=${selectedCompany}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      setBudgets(data.budgets || []);
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

  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const monthNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  // Группируем бюджеты по статьям
  const budgetByCategory = new Map<string, Map<string, number>>();
  for (const budget of budgets) {
    const catId = budget.category_id || budget.account_id;
    const month = budget.period?.substring(5, 7);
    if (!budgetByCategory.has(catId)) {
      budgetByCategory.set(catId, new Map());
    }
    budgetByCategory.get(catId)!.set(month, budget.planned_amount);
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Планирование</h2>
          <p className="text-gray-500 mt-1">Бюджет доходов и расходов</p>
        </div>
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Статья</th>
                  {monthNames.map(m => <th key={m} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Доходные статьи */}
                {accounts.filter(a => a.type === 'I').map(acc => (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">{acc.name}</td>
                    {months.map(m => {
                      const amount = budgetByCategory.get(acc.id)?.get(m);
                      return (
                        <td key={m} className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                          {amount ? amount.toLocaleString('ru-RU') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* Итого доходы */}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">Итого доходы</td>
                  {months.map(m => {
                    let total = 0;
                    accounts.filter(a => a.type === 'I').forEach(acc => {
                      total += budgetByCategory.get(acc.id)?.get(m) || 0;
                    });
                    return <td key={m} className="px-4 py-3 text-sm text-right font-bold text-gray-900">{total ? total.toLocaleString('ru-RU') : '—'}</td>;
                  })}
                </tr>
                
                {/* Расходные статьи */}
                {accounts.filter(a => a.type === 'X').map(acc => (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 sticky left-0 bg-white">{acc.name}</td>
                    {months.map(m => {
                      const amount = budgetByCategory.get(acc.id)?.get(m);
                      return (
                        <td key={m} className="px-4 py-3 text-sm text-right text-red-600 whitespace-nowrap">
                          {amount ? '-' + amount.toLocaleString('ru-RU') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* Итого расходы */}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">Итого расходы</td>
                  {months.map(m => {
                    let total = 0;
                    accounts.filter(a => a.type === 'X').forEach(acc => {
                      total += budgetByCategory.get(acc.id)?.get(m) || 0;
                    });
                    return <td key={m} className="px-4 py-3 text-sm text-right font-bold text-red-600">-{total ? total.toLocaleString('ru-RU') : '—'}</td>;
                  })}
                </tr>
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