'use client';

import { useEffect, useState } from 'react';

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
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

  const toggleCheck = (checkId: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  };

  const handleAutoFix = async (check: any) => {
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
        setAutoFixMessage(`✅ Исправлено: ${result.message || 'Операция выполнена'}`);
        // Перезагружаем диагностику
        setTimeout(() => loadDiagnostics(), 1000);
      } else {
        setAutoFixMessage(`❌ Ошибка: ${result.error || 'Не удалось выполнить'}`);
      }
    } catch (error) {
      setAutoFixMessage(`❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setAutoFixing(null);
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-white';
      case 'warning':
        return 'border-l-4 border-yellow-500 bg-white';
      case 'ok':
        return 'border-l-4 border-green-500 bg-white';
      case 'info':
        return 'border-l-4 border-blue-500 bg-white';
      default:
        return 'border-l-4 border-gray-300 bg-white';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">Критично</span>;
      case 'warning':
        return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">Предупреждение</span>;
      case 'ok':
        return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">ОК</span>;
      case 'info':
        return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">Инфо</span>;
      default:
        return null;
    }
  };

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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Заголовок */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Диагностика системы</h2>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-gray-600">{diagnostics.total_checks} проверок</span>
            <span className="text-red-600 font-medium">{diagnostics.critical} критичных</span>
            <span className="text-yellow-600 font-medium">{diagnostics.warnings} предупреждений</span>
            <span className="text-green-600 font-medium">{diagnostics.ok} ок</span>
            {diagnostics.execution_time && (
              <span className="text-gray-400 text-xs">
                Выполнено за {(diagnostics.execution_time / 1000).toFixed(2)} сек
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={() => loadDiagnostics(true)}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {refreshing && (
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          )}
          {refreshing ? 'Проверка...' : 'Перезапустить проверку'}
        </button>
      </div>

      {/* Сообщение об автоисправлении */}
      {autoFixMessage && (
        <div className={`mb-4 p-4 rounded-lg ${
          autoFixMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {autoFixMessage}
        </div>
      )}

      {/* Список проверок */}
      <div className="space-y-2">
        {diagnostics.checks.map((check: any) => {
          const isExpanded = expandedChecks.has(check.id);
          const hasDetails = check.details && (
            Array.isArray(check.details) ? check.details.length > 0 : Object.keys(check.details).length > 0
          );
          const hasRecommendation = check.recommendation;
          const hasAutoFix = check.auto_fix && check.auto_fix_action;
          
          return (
            <div key={check.id} className={`rounded-lg border border-gray-200 shadow-sm ${getSeverityStyle(check.severity)}`}>
              {/* Основная строка */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleCheck(check.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(check.severity)}
                    <span className="font-medium text-gray-900">{check.name}</span>
                    {check.count !== undefined && check.count > 0 && (
                      <span className="text-xs text-gray-500">({check.count})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{check.category}</span>
                    <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>
                
                <p className="text-sm mt-2 text-gray-600">{check.message}</p>
                
                {check.expected !== undefined && (
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <div>Ожидалось: <span className="font-medium">{check.expected?.toLocaleString?.('ru-RU') || check.expected}</span></div>
                    <div>Получено: <span className="font-medium">{check.actual?.toLocaleString?.('ru-RU') || check.actual}</span></div>
                    {check.difference !== undefined && (
                      <div>Разница: <span className="font-medium text-red-600">{check.difference?.toLocaleString?.('ru-RU') || check.difference}</span></div>
                    )}
                  </div>
                )}
              </div>

              {/* Раскрытая часть */}
              {isExpanded && (hasDetails || hasRecommendation || hasAutoFix) && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Детали */}
                  {hasDetails && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Детали</h4>
                      {Array.isArray(check.details) ? (
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                          {check.details.map((detail: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                              {typeof detail === 'object' ? (
                                <pre className="whitespace-pre-wrap">{JSON.stringify(detail, null, 2)}</pre>
                              ) : (
                                detail
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(check.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                  
                  {/* Рекомендация */}
                  {hasRecommendation && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Рекомендация</h4>
                      <p className="text-sm text-gray-700">{check.recommendation}</p>
                    </div>
                  )}
                  
                  {/* Кнопка автоисправления */}
                  {hasAutoFix && (
                    <div className="mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAutoFix(check);
                        }}
                        disabled={autoFixing === check.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {autoFixing === check.id ? 'Исправление...' : 'Исправить автоматически'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}