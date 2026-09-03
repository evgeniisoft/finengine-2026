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

  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const monthNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Планирование</h2>
          <p className="text-gray-500 mt-1">Бюджет доходов и расходов</p>
        </div>
        <div className="flex gap-2">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50">Статья</th>
                  {monthNames.map(m => <th key={m} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">Выручка</td>
                  {months.map(m => <td key={m} className="px-4 py-3 text-sm text-right text-gray-600">—</td>)}
                </tr>
                {accounts.filter(a => a.type === 'X').map(acc => (
                  <tr key={acc.id}>
                    <td className="px-4 py-3 text-sm text-gray-600 sticky left-0 bg-white">{acc.name}</td>
                    {months.map(m => <td key={m} className="px-4 py-3 text-sm text-right text-gray-400">—</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-gray-50 border-t">
            <p className="text-sm text-gray-500">Пока пусто. Данные бюджета появятся после создания.</p>
          </div>
        </div>
      )}
    </div>
  );
}