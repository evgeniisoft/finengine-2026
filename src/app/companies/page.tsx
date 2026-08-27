'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tax_system: 'USN_6',
    currency: 'RUB',
    is_group: false,
    parent_id: ''
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await api.getAll('Companies');
      setCompanies(data);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке компаний');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.create('Companies', formData);
      setShowForm(false);
      resetForm();
      loadCompanies();
    } catch (err) {
      setError('Ошибка при создании компании');
      console.error(err);
    }
  };

  const handleUpdate = async () => {
    if (!editingCompany) return;
    
    try {
      await api.update('Companies', editingCompany.id, formData);
      setShowForm(false);
      setEditingCompany(null);
      resetForm();
      loadCompanies();
    } catch (err) {
      setError('Ошибка при обновлении компании');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить компанию?')) return;
    
    try {
      await api.delete('Companies', id);
      loadCompanies();
    } catch (err) {
      setError('Ошибка при удалении компании');
      console.error(err);
    }
  };

  const handleEdit = (company: any) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      tax_system: company.tax_system,
      currency: company.currency,
      is_group: company.is_group,
      parent_id: company.parent_id || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tax_system: 'USN_6',
      currency: 'RUB',
      is_group: false,
      parent_id: ''
    });
    setEditingCompany(null);
  };

  return (
    <div>
      {/* Заголовок */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fe-text">Компании</h2>
          <p className="text-fe-text-secondary mt-1">
            Управление юридическими лицами холдинга
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + Добавить компанию
        </button>
      </div>

      {/* Форма создания/редактирования */}
      {showForm && (
        <div className="bg-fe-card rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-fe-text mb-4">
            {editingCompany ? 'Редактировать компанию' : 'Новая компания'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fe-text mb-1">
                Название
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fe-primary focus:border-transparent"
                placeholder="ООО «Ромашка»"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fe-text mb-1">
                Система налогообложения
              </label>
              <select
                value={formData.tax_system}
                onChange={(e) => setFormData({...formData, tax_system: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fe-primary focus:border-transparent"
              >
                <option value="USN_6">УСН 6%</option>
                <option value="USN_15">УСН 15%</option>
                <option value="OSNO">ОСНО</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-fe-text mb-1">
                Валюта учёта
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fe-primary focus:border-transparent"
              >
                <option value="RUB">₽ Рубль</option>
                <option value="USD">$ Доллар</option>
                <option value="EUR">€ Евро</option>
                <option value="CNY">¥ Юань</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_group}
                onChange={(e) => setFormData({...formData, is_group: e.target.checked})}
                className="mr-2 h-4 w-4 text-fe-primary focus:ring-fe-primary"
              />
              <label className="text-sm font-medium text-fe-text">
                Головная компания холдинга
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={editingCompany ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-fe-primary text-white rounded-lg text-sm font-medium hover:bg-fe-primary-dark transition-colors"
              >
                {editingCompany ? 'Сохранить' : 'Создать'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 text-fe-text rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Состояние загрузки */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fe-primary mx-auto"></div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Таблица компаний */}
      {!loading && !error && (
        <div className="bg-fe-card rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-fe-text-secondary uppercase">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fe-text-secondary uppercase">
                  СНО
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fe-text-secondary uppercase">
                  Валюта
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-fe-text-secondary uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-fe-text-secondary uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-fe-text">
                    {company.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-fe-text-secondary">
                    {company.tax_system === 'USN_6' && 'УСН 6%'}
                    {company.tax_system === 'USN_15' && 'УСН 15%'}
                    {company.tax_system === 'OSNO' && 'ОСНО'}
                  </td>
                  <td className="px-6 py-4 text-sm text-fe-text-secondary">
                    {company.currency}
                  </td>
                  <td className="px-6 py-4">
                    {company.is_group ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Холдинг
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Дочерняя
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(company)}
                      className="text-fe-primary hover:text-fe-primary-dark text-sm font-medium"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="text-fe-danger hover:text-red-700 text-sm font-medium"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {companies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-fe-text-secondary">Компании не найдены</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}