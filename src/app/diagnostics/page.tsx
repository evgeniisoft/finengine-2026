'use client';

import { useEffect, useState } from 'react';

interface DiagnosticCheck {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'ok' | 'info';
  name: string;
  count?: number;
  message: string;
  details?: any;
  expected?: number;
  actual?: number;
  difference?: number;
  recommendation?: string | null;
  auto_fix?: boolean;
  auto_fix_action?: string;
  auto_fix_data?: any[];
}

interface DiagnosticsData {
  timestamp: string;
  total_checks: number;
  critical: number;
  warnings: number;
  ok: number;
  execution_time: number;
  by_category: any;
  checks: DiagnosticCheck[];
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<DiagnosticCheck | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const [autoFixing, setAutoFixing] = useState<string | null>(null);
  const [autoFixMessage, setAutoFixMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async (showSpinner = false) => {
    if (showSpinner) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await fetch('/api/diagnostics');
      const data = await response.json();
      setDiagnostics(data);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAutoFix = async (check: DiagnosticCheck) => {
    if (!check.auto_fix || !check.auto_fix_action) return;
    
    setAutoFixing(check.id);
    setAutoFixMessage(null);
    
    try {
      const response = await fetch('/api/diagnostics/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_id: check.id,
          action: check.auto_fix_action,
          data: check.auto_fix_data
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAutoFixMessage(`Исправлено: ${result.message || 'Операция выполнена'}`);
        setTimeout(() => loadDiagnostics(), 1000);
      } else {
        setAutoFixMessage(`Ошибка: ${result.error || 'Не удалось выполнить'}`);
      }
    } catch (error) {
      setAutoFixMessage(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setAutoFixing(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 border-red-500';
      case 'warning': return 'text-yellow-600 border-yellow-500';
      case 'ok': return 'text-green-600 border-green-500';
      case 'info': return 'text-gray-500 border-gray-400';
      default: return 'text-gray-500 border-gray-300';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Критично';
      case 'warning': return 'Предупреждение';
      case 'ok': return 'ОК';
      case 'info': return 'Инфо';
      default: return severity;
    }
  };

  const categoryLabels: { [key: string]: string } = {
    'infrastructure': 'Инфраструктура',
    'data_quality': 'Качество данных',
    'dashboard': 'Дашборд',
    'financial': 'Финансовые расчёты',
    'taxes': 'Налоги',
    'planning': 'Планирование',
    'consolidation': 'Консолидация',
    'risks': 'Риски',
    'processes': 'Процессы'
  };

  const healthScore = diagnostics 
    ? Math.round(((diagnostics.ok + diagnostics.warnings * 0.5) / diagnostics.total_checks) * 100)
    : 0;

  if (loading && !diagnostics) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Загрузка диагностики...</span>
      </div>
    );
  }

  if (!diagnostics) {
    return <div className="text-center py-12 text-gray-500">Нет данных</div>;
  }

  const criticalChecks = diagnostics.checks.filter(c => c.severity === 'critical');
  const warningChecks = diagnostics.checks.filter(c => c.severity === 'warning');
  
  const groupedByCategory = diagnostics.checks.reduce((groups: any, check) => {
    const category = check.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(check);
    return groups;
  }, {});

  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
    const aCritical = groupedByCategory[a].filter((c: any) => c.severity === 'critical').length;
    const bCritical = groupedByCategory[b].filter((c: any) => c.severity === 'critical').length;
    return bCritical - aCritical;
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Шапка */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Диагностика системы</h2>
            <p className="text-sm text-gray-500 mt-1">
              Выполнено за {(diagnostics.execution_time / 1000).toFixed(2)} сек
            </p>
          </div>
          
          <button
            onClick={() => loadDiagnostics(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing && (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            )}
            {refreshing ? 'Проверка...' : 'Обновить'}
          </button>
        </div>

        {/* Индекс здоровья */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Индекс здоровья</span>
            <span className="text-sm font-bold text-gray-900">{healthScore}/100</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                healthScore >= 80 ? 'bg-green-500' : 
                healthScore >= 50 ? 'bg-yellow-500' : 
                'bg-red-500'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            <span className="text-red-600 font-medium">{diagnostics.critical} критичных</span>
            <span className="text-yellow-600 font-medium">{diagnostics.warnings} предупреждений</span>
            <span className="text-green-600 font-medium">{diagnostics.ok} ОК</span>
          </div>
        </div>
      </div>

      {/* Сообщение об автоисправлении */}
      {autoFixMessage && (
        <div className={`mb-4 p-4 rounded-lg ${
          autoFixMessage.startsWith('Исправлено') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {autoFixMessage}
        </div>
      )}

      {/* Фильтр */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setShowOnlyProblems(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            !showOnlyProblems ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Все проверки ({diagnostics.total_checks})
        </button>
        <button
          onClick={() => setShowOnlyProblems(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            showOnlyProblems ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Только проблемы ({criticalChecks.length + warningChecks.length})
        </button>
      </div>

      {/* Критические проблемы */}
      {criticalChecks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Критические проблемы ({criticalChecks.length})
          </h3>
          <div className="space-y-2">
            {criticalChecks.map(check => (
              <div
                key={check.id}
                onClick={() => setSelectedCheck(check)}
                className="p-4 rounded-lg border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{check.name}</span>
                  <span className="text-xs text-red-600">{getSeverityLabel(check.severity)}</span>
                </div>
                <p className="text-sm mt-1 text-gray-600">{check.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Предупреждения */}
      {warningChecks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Предупреждения ({warningChecks.length})
          </h3>
          <div className="space-y-2">
            {warningChecks.slice(0, 5).map(check => (
              <div
                key={check.id}
                onClick={() => setSelectedCheck(check)}
                className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 cursor-pointer hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{check.name}</span>
                  <span className="text-xs text-yellow-600">{getSeverityLabel(check.severity)}</span>
                </div>
                <p className="text-sm mt-1 text-gray-600">{check.message}</p>
              </div>
            ))}
            {warningChecks.length > 5 && (
              <button
                onClick={() => setShowOnlyProblems(true)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Показать ещё {warningChecks.length - 5} предупреждений
              </button>
            )}
          </div>
        </div>
      )}

      {/* Детальная проверка по модулям */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Детальная проверка по модулям
        </h3>
        <div className="space-y-2">
          {sortedCategories.map(category => {
            const categoryChecks = groupedByCategory[category];
            const isExpanded = expandedCategories.has(category);
            const criticalCount = categoryChecks.filter((c: any) => c.severity === 'critical').length;
            const warningCount = categoryChecks.filter((c: any) => c.severity === 'warning').length;
            const okCount = categoryChecks.filter((c: any) => c.severity === 'ok' || c.severity === 'info').length;
            
            const visibleChecks = showOnlyProblems
              ? categoryChecks.filter((c: any) => c.severity === 'critical' || c.severity === 'warning')
              : categoryChecks;
            
            if (visibleChecks.length === 0) return null;
            
            return (
              <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                    <span className="font-medium text-gray-900">
                      {categoryLabels[category] || category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {criticalCount > 0 && (
                      <span className="text-red-600">{criticalCount} крит.</span>
                    )}
                    {warningCount > 0 && (
                      <span className="text-yellow-600">{warningCount} предупр.</span>
                    )}
                    <span className="text-gray-400">{okCount} ОК</span>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {visibleChecks.map((check: DiagnosticCheck) => (
                      <div
                        key={check.id}
                        onClick={() => setSelectedCheck(check)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-2 ${getSeverityColor(check.severity)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{check.name}</span>
                          <span className="text-xs text-gray-500">
                            {getSeverityLabel(check.severity)}
                            {check.count !== undefined && check.count > 0 && ` (${check.count})`}
                          </span>
                        </div>
                        <p className="text-sm mt-1 text-gray-600">{check.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => {
            const exportData = JSON.stringify(diagnostics, null, 2);
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diagnostics_${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          Экспорт отчёта
        </button>
        <button
          onClick={() => {
            const fixableChecks = diagnostics.checks.filter(c => c.auto_fix && c.auto_fix_action);
            fixableChecks.forEach(check => handleAutoFix(check));
          }}
          disabled={autoFixing !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {autoFixing !== null ? 'Исправление...' : 'Исправить автоматически'}
        </button>
      </div>

      {/* Модальное окно с деталями */}
      {selectedCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedCheck.name}</h3>
                  <div className="mt-1 flex items-center gap-3">
                    <span className={`text-sm font-medium ${getSeverityColor(selectedCheck.severity)}`}>
                      {getSeverityLabel(selectedCheck.severity)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {categoryLabels[selectedCheck.category] || selectedCheck.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCheck(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-700 mb-4">{selectedCheck.message}</p>

              {selectedCheck.expected !== undefined && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 space-y-2">
                    <div>Ожидалось: <span className="font-medium">{selectedCheck.expected?.toLocaleString?.('ru-RU') || selectedCheck.expected}</span></div>
                    <div>Получено: <span className="font-medium">{selectedCheck.actual?.toLocaleString?.('ru-RU') || selectedCheck.actual}</span></div>
                    {selectedCheck.difference !== undefined && (
                      <div>Разница: <span className="font-medium text-red-600">{selectedCheck.difference?.toLocaleString?.('ru-RU') || selectedCheck.difference}</span></div>
                    )}
                  </div>
                </div>
              )}

              {selectedCheck.details && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Детали</h4>
                  <pre className="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedCheck.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedCheck.recommendation && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Рекомендация</h4>
                  <p className="text-sm text-gray-600">{selectedCheck.recommendation}</p>
                </div>
              )}

              {selectedCheck.auto_fix && selectedCheck.auto_fix_action && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAutoFix(selectedCheck)}
                    disabled={autoFixing === selectedCheck.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {autoFixing === selectedCheck.id ? 'Исправление...' : 'Исправить автоматически'}
                  </button>
                  <button
                    onClick={() => setSelectedCheck(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}