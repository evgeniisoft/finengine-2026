'use client';

import { useEffect, useState } from 'react';

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    try {
      const response = await fetch('/api/diagnostics');
      const data = await response.json();
      setDiagnostics(data);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  if (!diagnostics) {
    return <div className="text-center py-12">Нет данных</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Диагностика системы</h2>
        <p className="text-gray-500 mt-1">
          {diagnostics.total_checks} проверок • 
          <span className="text-red-600"> {diagnostics.critical} критичных</span> • 
          <span className="text-yellow-600"> {diagnostics.warnings} предупреждений</span> • 
          <span className="text-green-600"> {diagnostics.ok} ок</span>
        </p>
      </div>

      <div className="space-y-3">
        {diagnostics.checks.map((check: any) => (
          <div key={check.id} className={`p-4 rounded-xl border ${
            check.severity === 'critical' ? 'bg-red-50 border-red-200' :
            check.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {check.severity === 'critical' ? '🔴' : check.severity === 'warning' ? '🟡' : '🟢'} {check.name}
              </span>
              <span className="text-sm text-gray-500">{check.category}</span>
            </div>
            <p className="text-sm mt-1 text-gray-600">{check.message}</p>
            {check.expected !== undefined && (
              <p className="text-xs mt-1 text-gray-400">
                Ожидалось: {check.expected?.toLocaleString?.('ru-RU') || check.expected} • 
                Получено: {check.actual?.toLocaleString?.('ru-RU') || check.actual} • 
                Разница: {check.difference?.toLocaleString?.('ru-RU') || check.difference}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={loadDiagnostics}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Перезапустить проверку
      </button>
    </div>
  );
}