'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function DataSourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [showImportBlock, setShowImportBlock] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  
  // Форма
  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'csv',
    company_id: '',
    file_name: '',
    file_content: '',
    host: '',
    port: '',
    database: '',
    user: '',
    password: '',
    url: '',
    api_key: ''
  });

  // Маппинг
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [mappingFields, setMappingFields] = useState<{[key: string]: string}>({});
  const [showPreview, setShowPreview] = useState(false);

  const targetFields = [
    { value: 'date', label: 'Дата', required: true },
    { value: 'description', label: 'Описание', required: false },
    { value: 'amount', label: 'Сумма', required: true },
    { value: 'currency', label: 'Валюта', required: false },
    { value: 'company_id', label: 'Компания', required: false },
    { value: 'counterparty', label: 'Контрагент', required: false },
    { value: 'debit_account', label: 'Счёт дебета', required: false },
    { value: 'credit_account', label: 'Счёт кредита', required: false },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sourcesData, mappingsData] = await Promise.all([
        api.getAll('DataSources'),
        api.getAll('DataMappings')
      ]);
      setSources(sourcesData);
      setMappings(mappingsData);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обработка загрузки файла
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      setSourceForm({
        ...sourceForm,
        file_name: file.name,
        file_content: content
      });
      
      // Парсим CSV
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0]);
        setFileHeaders(headers);
        
        const rows = lines.slice(1).map(line => parseCSVLine(line));
        setFileRows(rows);
        
        // Автоматическое сопоставление
        const autoMapping: {[key: string]: string} = {};
        for (const header of headers) {
          const lower = header.toLowerCase();
          if (lower.includes('дат')) autoMapping[header] = 'date';
          else if (lower.includes('сумм') || lower.includes('amount') || lower.includes('цена')) autoMapping[header] = 'amount';
          else if (lower.includes('описан') || lower.includes('назнач') || lower.includes('коммент')) autoMapping[header] = 'description';
          else if (lower.includes('валют') || lower.includes('currency')) autoMapping[header] = 'currency';
          else if (lower.includes('контрагент') || lower.includes('counterparty') || lower.includes('клиент')) autoMapping[header] = 'counterparty';
          else if (lower.includes('компан') || lower.includes('company') || lower.includes('организация')) autoMapping[header] = 'company_id';
        }
        setMappingFields(autoMapping);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Создание источника
  const handleCreateSource = async () => {
    if (!sourceForm.name) {
      alert('Введите название');
      return;
    }
    
    let config: any = {};
    
    if (sourceForm.type === 'csv' || sourceForm.type === 'excel' || sourceForm.type === '1c') {
      config = {
        file_name: sourceForm.file_name,
        file_content: sourceForm.file_content
      };
    } else if (sourceForm.type === 'sql') {
      if (!sourceForm.host || !sourceForm.database || !sourceForm.user) {
        alert('Заполните параметры подключения');
        return;
      }
      config = {
        host: sourceForm.host,
        port: sourceForm.port,
        database: sourceForm.database,
        user: sourceForm.user,
        password: sourceForm.password
      };
    } else if (sourceForm.type === 'api') {
      if (!sourceForm.url) {
        alert('Введите URL');
        return;
      }
      config = {
        url: sourceForm.url,
        api_key: sourceForm.api_key
      };
    }
    
    try {
      await api.create('DataSources', {
        name: sourceForm.name,
        type: sourceForm.type,
        config: JSON.stringify(config),
        company_id: sourceForm.company_id,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: '',
        deleted_at: ''
      });
      
      alert('Источник сохранён');
      setShowForm(false);
      resetSourceForm();
      loadData();
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при сохранении');
    }
  };

  const resetSourceForm = () => {
    setSourceForm({
      name: '',
      type: 'csv',
      company_id: '',
      file_name: '',
      file_content: '',
      host: '',
      port: '',
      database: '',
      user: '',
      password: '',
      url: '',
      api_key: ''
    });
  };

  // Выбор источника
  const handleSelectSource = (source: any) => {
    setSelectedSource(source);
    setShowImportBlock(true);
    setImportResult(null);
    
    // Восстанавливаем файл из config
    try {
      const config = JSON.parse(source.config || '{}');
      if (config.file_content) {
        const lines = config.file_content.split('\n').filter((line: string) => line.trim());
        if (lines.length > 0) {
          const headers = parseCSVLine(lines[0]);
          setFileHeaders(headers);
          const rows = lines.slice(1).map((line: string) => parseCSVLine(line));
          setFileRows(rows);
          
          // Восстанавливаем маппинг
          const savedMapping = mappings.find(m => m.source_id === source.id);
          if (savedMapping) {
            try {
              const parsedMapping = JSON.parse(savedMapping.mappings || '{}');
              setMappingFields(parsedMapping);
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.error('Ошибка восстановления:', e);
    }
  };

  // Сохранение маппинга
  const handleSaveMapping = async () => {
    if (!selectedSource) {
      alert('Выберите источник');
      return;
    }
    
    try {
      await api.create('DataMappings', {
        source_id: selectedSource.id,
        name: `Маппинг для ${selectedSource.name}`,
        mappings: JSON.stringify(mappingFields),
        defaults: JSON.stringify({ currency: 'RUB' }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: '',
        deleted_at: ''
      });
      
      alert('Маппинг сохранён');
      loadData();
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при сохранении маппинга');
    }
  };

  // Валидация перед импортом
  const validateMapping = (): string[] => {
    const errors: string[] = [];
    const requiredFields = targetFields.filter(f => f.required);
    
    for (const field of requiredFields) {
      const isMapped = Object.values(mappingFields).includes(field.value);
      if (!isMapped) {
        errors.push(`Не сопоставлено обязательное поле: ${field.label}`);
      }
    }
    
    return errors;
  };

  // Импорт данных
  const handleImport = async () => {
    if (!selectedSource) {
      alert('Выберите источник');
      return;
    }
    
    if (fileRows.length === 0) {
      alert('Загрузите файл');
      return;
    }
    
    // Валидация
    const validationErrors = validateMapping();
    if (validationErrors.length > 0) {
      alert('Ошибки валидации:\n' + validationErrors.join('\n'));
      return;
    }
    
    try {
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < fileRows.length; i++) {
        const row = fileRows[i];
        const transaction: any = {};
        
        for (const [sourceField, targetField] of Object.entries(mappingFields)) {
          const fieldIndex = fileHeaders.indexOf(sourceField);
          const value = row[fieldIndex] || '';
          
          if (targetField === 'amount') {
            transaction[targetField] = parseFloat(String(value).replace(',', '.').replace(/\s/g, '')) || 0;
          } else if (targetField === 'date') {
            // Нормализация даты
            transaction[targetField] = normalizeDate(value);
          } else {
            transaction[targetField] = value;
          }
        }
        
        // Валидация строки
        if (!transaction.date || !transaction.amount) {
          skipped++;
          errors.push(`Строка ${i + 2}: нет даты или суммы`);
          continue;
        }
        
        await api.create('Transactions', {
          date: transaction.date,
          description: transaction.description || '',
          amount: transaction.amount,
          currency: transaction.currency || 'RUB',
          type: 'income',
          company_id: transaction.company_id || '',
          debit_account_id: transaction.debit_account || 'acc-bank-001',
          credit_account_id: transaction.credit_account || 'acc-in-revenue',
          amount_rub: transaction.amount,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: '1c',
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        imported++;
      }
      
      setImportResult(`Импорт завершён: ${imported} создано, ${skipped} пропущено${errors.length > 0 ? '\n' + errors.slice(0, 5).join('\n') : ''}`);
      
    } catch (error) {
      console.error('Ошибка импорта:', error);
      alert('Ошибка при импорте');
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Источники данных</h2>
          <p className="text-gray-500 mt-1">
            Подключение и настройка внешних источников
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Добавить источник
        </button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Новый источник</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
              <input
                type="text"
                value={sourceForm.name}
                onChange={(e) => setSourceForm({...sourceForm, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="1С Бухгалтерия"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
              <select
                value={sourceForm.type}
                onChange={(e) => setSourceForm({...sourceForm, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="csv">CSV файл</option>
                <option value="excel">Excel файл</option>
                <option value="1c">1С (файловая выгрузка)</option>
                <option value="sql">SQL база данных</option>
                <option value="api">API (REST)</option>
              </select>
            </div>
            
            {/* Файловые типы */}
            {(sourceForm.type === 'csv' || sourceForm.type === 'excel' || sourceForm.type === '1c') && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Файл</label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xml"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                {sourceForm.file_name && (
                  <p className="text-sm text-gray-500 mt-1">
                    Загружен: {sourceForm.file_name}
                  </p>
                )}
              </div>
            )}
            
            {/* SQL */}
            {sourceForm.type === 'sql' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1">Хост *</label>
                  <input type="text" value={sourceForm.host}
                    onChange={(e) => setSourceForm({...sourceForm, host: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="localhost" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1">Порт</label>
                  <input type="text" value={sourceForm.port}
                    onChange={(e) => setSourceForm({...sourceForm, port: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="5432" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1">База данных *</label>
                  <input type="text" value={sourceForm.database}
                    onChange={(e) => setSourceForm({...sourceForm, database: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="finengine" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1">Пользователь *</label>
                  <input type="text" value={sourceForm.user}
                    onChange={(e) => setSourceForm({...sourceForm, user: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="admin" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1">Пароль</label>
                  <input type="password" value={sourceForm.password}
                    onChange={(e) => setSourceForm({...sourceForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </>
            )}
            
            {/* API */}
            {sourceForm.type === 'api' && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1">URL *</label>
                  <input type="text" value={sourceForm.url}
                    onChange={(e) => setSourceForm({...sourceForm, url: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://api.example.com/v1" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1">Ключ API</label>
                  <input type="password" value={sourceForm.api_key}
                    onChange={(e) => setSourceForm({...sourceForm, api_key: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreateSource}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Сохранить источник
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список источников */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Сохранённые источники</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : sources.length === 0 ? (
          <p className="text-gray-500">Нет сохранённых источников</p>
        ) : (
          <div className="space-y-2">
            {sources.map(source => (
              <div key={source.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedSource?.id === source.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleSelectSource(source)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{source.name}</p>
                    <p className="text-sm text-gray-500">
                      Тип: {source.type}
                      {(() => {
                        try {
                          const config = JSON.parse(source.config || '{}');
                          if (config.file_name) return ` • Файл: ${config.file_name}`;
                          if (config.host) return ` • Хост: ${config.host}`;
                          if (config.url) return ` • URL: ${config.url}`;
                          return '';
                        } catch { return ''; }
                      })()}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {selectedSource?.id === source.id ? 'Выбран' : 'Кликните для выбора'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Блок импорта */}
      {showImportBlock && selectedSource && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Импорт: {selectedSource.name}
            </h3>
            <button onClick={() => setShowImportBlock(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
          
          {/* Загрузка файла */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Загрузить файл</label>
            <input type="file" accept=".csv,.txt,.xlsx,.xml"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          
          {/* Маппинг */}
          {fileHeaders.length > 0 && (
            <>
              <h4 className="font-medium text-gray-900 mb-3">Сопоставление полей</h4>
              <div className="space-y-2 mb-4">
                {fileHeaders.map(header => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-56">{header}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={mappingFields[header] || ''}
                      onChange={(e) => setMappingFields({...mappingFields, [header]: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1">
                      <option value="">Не импортировать</option>
                      {targetFields.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}{field.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              
              {/* Предпросмотр */}
              {fileRows.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Предпросмотр (первые 5 строк)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr>
                          {fileHeaders.map(header => (
                            <th key={header} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 bg-gray-50">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fileRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 text-gray-600">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Результат импорта */}
              {importResult && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm whitespace-pre-line">{importResult}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button onClick={handleSaveMapping}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  Сохранить маппинг
                </button>
                <button onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Импортировать данные
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function normalizeDate(value: string): string {
  // Пробуем DD.MM.YYYY
  const dotParts = value.split('.');
  if (dotParts.length === 3) {
    return `${dotParts[2]}-${dotParts[1]}-${dotParts[0]}`;
  }
  
  // Пробуем DD/MM/YYYY
  const slashParts = value.split('/');
  if (slashParts.length === 3) {
    return `${slashParts[2]}-${slashParts[1]}-${slashParts[0]}`;
  }
  
  // Если уже YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.substring(0, 10);
  }
  
  return value;
}