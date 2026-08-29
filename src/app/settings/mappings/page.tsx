'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function MappingsPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMapping, setSelectedMapping] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mappingsData, sourcesData] = await Promise.all([
        api.getAll('DataMappings'),
        api.getAll('DataSources')
      ]);
      setMappings(mappingsData);
      setSources(sourcesData);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить маппинг?')) return;
    
    try {
      await api.delete('DataMappings', id);
      loadData();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleViewMapping = (mapping: any) => {
    setSelectedMapping(mapping);
    setShowDetail(true);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Маппинги</h2>
        <p className="text-gray-500 mt-1">
          Сохранённые сопоставления полей для импорта данных
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Источник
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Создан
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Нет сохранённых маппингов
                  </td>
                </tr>
              ) : (
                mappings.map(mapping => {
                  const source = sources.find(s => s.id === mapping.source_id);
                  
                  return (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {mapping.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {source ? source.name : mapping.source_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {mapping.created_at ? new Date(mapping.created_at).toLocaleDateString('ru-RU') : ''}
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          onClick={() => handleViewMapping(mapping)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
                        >
                          Просмотр
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно с деталями маппинга */}
      {showDetail && selectedMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedMapping.name}
              </h3>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Сопоставление полей:</h4>
              
              {(() => {
                try {
                  const mappings = JSON.parse(selectedMapping.mappings || '{}');
                  const defaults = JSON.parse(selectedMapping.defaults || '{}');
                  
                  return (
                    <>
                      <div className="space-y-2">
                        {Object.entries(mappings).map(([source, target]) => (
                          <div key={source} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">{source}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-sm font-medium text-gray-900">{target as string}</span>
                          </div>
                        ))}
                      </div>
                      
                      {Object.keys(defaults).length > 0 && (
                        <>
                          <h4 className="font-medium text-gray-700 mt-4">Значения по умолчанию:</h4>
                          <div className="space-y-2">
                            {Object.entries(defaults).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">{key}</span>
                                <span className="text-sm font-medium text-gray-900">{value as string}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                } catch (e) {
                  return <p className="text-sm text-gray-500">Ошибка парсинга маппинга</p>;
                }
              })()}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}