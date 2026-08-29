'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function DataSourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  
  // Форма источника
  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'csv',
    company_id: '',
    config: {} as any
  });
  
  // Файл
  const [fileContent, setFileContent] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  
  // Маппинг
  const [mappingFields, setMappingFields] = useState<{[key: string]: string}>({});

  const targetFields = [
    'date', 'description', 'amount', 'currency', 
    'company_id', 'counterparty', 'debit_account', 'credit_account'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sourcesData, companiesData] = await Promise.all([
        api.getAll('DataSources'),
        api.getAll('Companies')
      ]);
      setSources(sourcesData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обновление config при изменении типа
  const handleTypeChange = (type: string) => {
    let config = {};
    
    switch (type) {
      case 'csv':
        config = { delimiter: ',', encoding: 'UTF-8' };
        break;
      case 'excel':
        config = { sheet_number: 1, header_row: 1 };
        break;
      case '1c':
        config = { connection_type: 'file', format: 'csv' };
        break;
      case 'sql':
        config = { host: '', port: '', database: '', user: '', password: '' };
        break;
      case 'api':
        config = { url: '', method: 'GET', api_key: '' };
        break;
      case 'google_sheets':
        config = { spreadsheet_id: '', sheet_name: '' };
        break;
    }
    
    setSourceForm({ ...sourceForm, type, config });
  };

  // Обновление config
  const updateConfig = (key: string, value: any) => {
    setSourceForm({
      ...sourceForm,
      config: { ...sourceForm.config, [key]: value }
    });
  };

  // Создание источника
  const handleCreateSource = async () => {
    if (!sourceForm.name) {
      alert('Введите название источника');
      return;
    }
    
    try {
      await api.create('DataSources', {
        name: sourceForm.name,
        type: sourceForm.type,
        config: JSON.stringify(sourceForm.config),
        company_id: sourceForm.company_id,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: '',
        deleted_at: ''
      });
      
      setShowForm(false);
      setSourceForm({ name: '', type: 'csv', company_id: '', config: {} });
      loadData();
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при создании источника');
    }
  };

  // Загрузка файла
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      
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
          else if (lower.includes('сумм') || lower.includes('amount')) autoMapping[header] = 'amount';
          else if (lower.includes('описан') || lower.includes('назнач')) autoMapping[header] = 'description';
          else if (lower.includes('валют') || lower.includes('currency')) autoMapping[header] = 'currency';
          else if (lower.includes('контрагент') || lower.includes('counterparty')) autoMapping[header] = 'counterparty';
          else if (lower.includes('компан') || lower.includes('company')) autoMapping[header] = 'company_id';
        }
        setMappingFields(autoMapping);
      }
    };
    reader.readAsText(file, 'UTF-8');
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
    
    if (Object.keys(mappingFields).length === 0) {
      alert('Настройте маппинг полей');
      return;
    }
    
    try {
      let imported = 0;
      let skipped = 0;
      
      for (const row of fileRows) {
        const transaction: any = {};
        
        for (const [sourceField, targetField] of Object.entries(mappingFields)) {
          const fieldIndex = fileHeaders.indexOf(sourceField);
          const value = row[fieldIndex] || '';
          
          if (targetField === 'amount') {
            transaction[targetField] = parseFloat(value.replace(',', '.')) || 0;
          } else {
            transaction[targetField] = value;
          }
        }
        
        if (!transaction.date || !transaction.amount) {
          skipped++;
          continue;
        }
        
        await api.create('Transactions', {
          ...transaction,
          amount_rub: transaction.amount,
          currency: transaction.currency || 'RUB',
          type: 'income',
          company_id: transaction.company_id || selectedSource.company_id || '',
          debit_account_id: transaction.debit_account || 'acc-bank-001',
          credit_account_id: transaction.credit_account || 'acc-in-revenue',
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
      
      alert(`Импорт завершён: ${imported} создано, ${skipped} пропущено`);
      setFileContent('');
      setFileHeaders([]);
      setFileRows([]);
      setMappingFields({});
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
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="csv">CSV файл</option>
                <option value="excel">Excel файл</option>
                <option value="1c">1С</option>
                <option value="sql">SQL база</option>
                <option value="api">API</option>
                <option value="google_sheets">Google Sheets</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Компания</label>
              <select
                value={sourceForm.company_id}
                onChange={(e) => setSourceForm({...sourceForm, company_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Выберите компанию</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Динамические параметры конфигурации */}
          <div className="mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Параметры подключения</h4>
            <div className="grid grid-cols-2 gap-4">
              {sourceForm.type === 'csv' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Разделитель</label>
                    <select
                      value={sourceForm.config.delimiter || ','}
                      onChange={(e) => updateConfig('delimiter', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value=",">Запятая (,)</option>
                      <option value=";">Точка с запятой (;)</option>
                      <option value="\t">Табуляция</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Кодировка</label>
                    <select
                      value={sourceForm.config.encoding || 'UTF-8'}
                      onChange={(e) => updateConfig('encoding', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="UTF-8">UTF-8</option>
                      <option value="Windows-1251">Windows-1251</option>
                    </select>
                  </div>
                </>
              )}

              {sourceForm.type === 'excel' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Номер листа</label>
                    <input
                      type="number"
                      value={sourceForm.config.sheet_number || 1}
                      onChange={(e) => updateConfig('sheet_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Строка заголовков</label>
                    <input
                      type="number"
                      value={sourceForm.config.header_row || 1}
                      onChange={(e) => updateConfig('header_row', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              {sourceForm.type === '1c' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Способ подключения</label>
                    <select
                      value={sourceForm.config.connection_type || 'file'}
                      onChange={(e) => updateConfig('connection_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="file">Файл</option>
                      <option value="api">API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Формат</label>
                    <select
                      value={sourceForm.config.format || 'csv'}
                      onChange={(e) => updateConfig('format', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="csv">CSV</option>
                      <option value="excel">Excel</option>
                      <option value="xml">XML</option>
                    </select>
                  </div>
                  {sourceForm.config.connection_type === 'api' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">URL API</label>
                        <input
                          type="text"
                          value={sourceForm.config.url || ''}
                          onChange={(e) => updateConfig('url', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                        <input
                          type="text"
                          value={sourceForm.config.user || ''}
                          onChange={(e) => updateConfig('user', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                        <input
                          type="password"
                          value={sourceForm.config.password || ''}
                          onChange={(e) => updateConfig('password', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {sourceForm.type === 'sql' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Хост</label>
                    <input
                      type="text"
                      value={sourceForm.config.host || ''}
                      onChange={(e) => updateConfig('host', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Порт</label>
                    <input
                      type="text"
                      value={sourceForm.config.port || ''}
                      onChange={(e) => updateConfig('port', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">База данных</label>
                    <input
                      type="text"
                      value={sourceForm.config.database || ''}
                      onChange={(e) => updateConfig('database', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Пользователь</label>
                    <input
                      type="text"
                      value={sourceForm.config.user || ''}
                      onChange={(e) => updateConfig('user', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                    <input
                      type="password"
                      value={sourceForm.config.password || ''}
                      onChange={(e) => updateConfig('password', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              {sourceForm.type === 'api' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="text"
                      value={sourceForm.config.url || ''}
                      onChange={(e) => updateConfig('url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Метод</label>
                    <select
                      value={sourceForm.config.method || 'GET'}
                      onChange={(e) => updateConfig('method', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API ключ</label>
                    <input
                      type="text"
                      value={sourceForm.config.api_key || ''}
                      onChange={(e) => updateConfig('api_key', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              {sourceForm.type === 'google_sheets' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID таблицы</label>
                    <input
                      type="text"
                      value={sourceForm.config.spreadsheet_id || ''}
                      onChange={(e) => updateConfig('spreadsheet_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название листа</label>
                    <input
                      type="text"
                      value={sourceForm.config.sheet_name || ''}
                      onChange={(e) => updateConfig('sheet_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreateSource}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Сохранить
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список источников */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Источники</h3>
        {sources.length === 0 ? (
          <p className="text-gray-500">Нет источников</p>
        ) : (
          <div className="space-y-2">
            {sources.map(source => (
              <div
                key={source.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedSource?.id === source.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedSource(source)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{source.name}</p>
                    <p className="text-sm text-gray-500">
                      {source.type} | {source.config ? JSON.parse(source.config).connection_type || JSON.parse(source.config).host || '' : ''}
                    </p>
                  </div>
                  {selectedSource?.id === source.id && (
                    <span className="text-blue-600 text-sm font-medium">Выбран</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Загрузка файла и маппинг */}
      {selectedSource && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Загрузка данных для: {selectedSource.name}
          </h3>
          
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="mb-4"
          />
          
          {fileHeaders.length > 0 && (
            <>
              <h4 className="font-medium text-gray-900 mb-3">Сопоставление полей</h4>
              <div className="space-y-2 mb-4">
                {fileHeaders.map(header => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-48">{header}</span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={mappingFields[header] || ''}
                      onChange={(e) => setMappingFields({
                        ...mappingFields,
                        [header]: e.target.value
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Не импортировать</option>
                      {targetFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Импортировать данные
              </button>
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