'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    currency: 'RUB',
    type: 'income',
    company_id: '',
    source: 'manual'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transactionsData, companiesData] = await Promise.all([
        api.getAll('Transactions'),
        api.getAll('Companies')
      ]);
      setTransactions(transactionsData);
      setCompanies(companiesData);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование суммы с разрядами
  const formatAmount = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Обработка ввода суммы с разрядами
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Убираем всё кроме цифр
    if (value === '') {
      setFormData({ ...formData, amount: '' });
      return;
    }
    const num = parseInt(value);
    if (num > 999999999) return; // Максимум 999 999 999
    setFormData({ ...formData, amount: num.toString() });
  };

  // Отображение суммы с разрядами в инпуте
  const displayAmount = (value: string) => {
    if (!value) return '';
    return formatAmount(value);
  };

  const handleCreate = async () => {
    try {
      // Валидация
      if (!formData.company_id) {
        alert('Выберите компанию!');
        return;
      }
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        alert('Введите сумму больше 0!');
        return;
      }
      if (!formData.description.trim()) {
        alert('Введите описание операции!');
        return;
      }
      if (!formData.date) {
        alert('Выберите дату!');
        return;
      }

      const newTransaction = {
        date: formData.date,
        company_id: formData.company_id,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        type: formData.type,
        debit_account_id: formData.type === 'income' ? 'acc-bank-001' : 'acc-out-other',
        credit_account_id: formData.type === 'income' ? 'acc-in-revenue' : 'acc-bank-001',
        amount_rub: parseFloat(formData.amount),
        counterparty_id: '',
        contract_id: '',
        transaction_group_id: '',
        is_system: false,
        external_id: '',
        source: formData.source,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Создаем операцию:', newTransaction);

      const result = await api.create('Transactions', newTransaction);
      console.log('Результат:', result);

      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Ошибка создания:', err);
      alert('Ошибка при создании операции. Подробности в консоли (F12)');
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      currency: 'RUB',
      type: 'income',
      company_id: '',
      source: 'manual'
    });
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Операции</h2>
          <p className="text-gray-500 mt-1">
            Журнал финансовых операций
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-sm hover:shadow-md cursor-pointer"
        >
          + Добавить операцию
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Новая операция
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Компания <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 cursor-pointer"
              >
                <option value="">-- Выберите компанию --</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип операции <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 cursor-pointer"
              >
                <option value="income">Доход</option>
                <option value="expense">Расход</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayAmount(formData.amount)}
                onChange={handleAmountChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                placeholder="0"
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500 mt-1">
                Введите сумму в рублях
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Валюта
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 cursor-pointer"
              >
                <option value="RUB">₽ Рубль</option>
                <option value="USD">$ Доллар</option>
                <option value="EUR">€ Евро</option>
                <option value="CNY">¥ Юань</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                placeholder="Например: Оплата по счёту №123 от 01.01.2026"
              />
            </div>

            <div className="md:col-span-2 flex gap-3 pt-4">
              <button
                onClick={handleCreate}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                Создать операцию
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 active:bg-gray-300 transition-all cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Компания
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Описание
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const company = companies.find(c => c.id === transaction.company_id);
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {company ? company.name : 'Компания не найдена'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatAmount(transaction.amount)} {transaction.currency}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${transaction.type === 'income'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {transaction.type === 'income' ? 'Доход' : 'Расход'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {transactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Операции не найдены</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}