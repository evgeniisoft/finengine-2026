'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Dashboard() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getAll('Companies');
      setCompanies(data);
      setError(null);
    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalCompanies = companies.length;
  const groupCompanies = companies.filter(c => c.is_group).length;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-fe-text">Дашборд</h2>
        <p className="text-fe-text-secondary mt-1">
          Обзор финансового состояния холдинга
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-fe-card rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-fe-text-secondary">
            Компании
          </h3>
          <p className="text-3xl font-bold text-fe-text mt-2">
            {loading ? '...' : totalCompanies}
          </p>
        </div>

        <div className="bg-fe-card rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-fe-text-secondary">
            Холдинги
          </h3>
          <p className="text-3xl font-bold text-fe-text mt-2">
            {loading ? '...' : groupCompanies}
          </p>
        </div>

        <div className="bg-fe-card rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-fe-text-secondary">
            Валюта учёта
          </h3>
          <p className="text-3xl font-bold text-fe-text mt-2">₽</p>
        </div>
      </div>

      <div className="bg-fe-card rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-fe-text">
            Компании холдинга
          </h3>
        </div>

        {loading && (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fe-primary mx-auto"></div>
          </div>
        )}

        {error && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm text-red-700 underline"
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="divide-y divide-gray-200">
            {companies.map((company) => (
              <div key={company.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-fe-text">
                      {company.name}
                    </h4>
                    <p className="text-sm text-fe-text-secondary mt-1">
                      {company.tax_system === 'USN_6' && 'УСН 6%'}
                      {company.tax_system === 'USN_15' && 'УСН 15%'}
                      {company.tax_system === 'OSNO' && 'ОСНО'}
                    </p>
                  </div>
                  {company.is_group && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Холдинг
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}