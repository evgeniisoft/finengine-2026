'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function DataSourcesPage() {
    const [sources, setSources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedSource, setSelectedSource] = useState<any>(null);

    // Форма
    const [sourceForm, setSourceForm] = useState({
        name: '',
        type: 'csv',
        company_id: '',
        // Для файлов
        file_name: '',
        file_content: '',
        // Для SQL
        host: '',
        port: '',
        database: '',
        user: '',
        password: '',
        // Для API
        url: '',
        api_key: '',
        // Для 1С
        file_format: 'csv',
        version_1c: '8.3',
        config_1c: 'accounting'
    });

    // Маппинг
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [fileRows, setFileRows] = useState<string[][]>([]);
    const [mappingFields, setMappingFields] = useState<{ [key: string]: string }>({});
    const [showMapping, setShowMapping] = useState(false);

    const targetFields = [
        { value: 'date', label: 'Дата' },
        { value: 'description', label: 'Описание' },
        { value: 'amount', label: 'Сумма' },
        { value: 'currency', label: 'Валюта' },
        { value: 'company_id', label: 'Компания' },
        { value: 'counterparty', label: 'Контрагент' },
        { value: 'debit_account', label: 'Счёт дебета' },
        { value: 'credit_account', label: 'Счёт кредита' },
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await api.getAll('DataSources');
            setSources(data);
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
                const autoMapping: { [key: string]: string } = {};
                for (const header of headers) {
                    const lower = header.toLowerCase();
                    if (lower.includes('дат')) autoMapping[header] = 'date';
                    else if (lower.includes('сумм') || lower.includes('amount')) autoMapping[header] = 'amount';
                    else if (lower.includes('описан') || lower.includes('назнач')) autoMapping[header] = 'description';
                    else if (lower.includes('валют') || lower.includes('currency')) autoMapping[header] = 'currency';
                    else if (lower.includes('контрагент') || lower.includes('counterparty')) autoMapping[header] = 'counterparty';
                }
                setMappingFields(autoMapping);
                setShowMapping(true);
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

        // Формируем config в зависимости от типа
        let config: any = {};

        if (sourceForm.type === 'csv' || sourceForm.type === 'excel') {
            config = {
                file_name: sourceForm.file_name,
                file_content: sourceForm.file_content
            };
        }
        if (sourceForm.type === '1c') {
            config = {
                file_name: sourceForm.file_name,
                file_content: sourceForm.file_content,
                file_format: sourceForm.file_format,
                version_1c: sourceForm.version_1c,
                config_1c: sourceForm.config_1c
            };
        }
        else if (sourceForm.type === 'sql') {
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
                api_key: '',
                file_format: 'csv',
                version_1c: '8.3',
                config_1c: 'accounting'
            });
            loadData();
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении');
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
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении маппинга');
        }
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
            alert('Настройте маппинг');
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

            alert(`Импорт: ${imported} создано, ${skipped} пропущено`);
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
                                onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="1С Бухгалтерия"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Тип *</label>
                            <select
                                value={sourceForm.type}
                                onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="csv">CSV файл</option>
                                <option value="excel">Excel файл</option>
                                <option value="sql">SQL база данных</option>
                                <option value="api">API (REST)</option>
                                <option value="1c">1С</option>
                            </select>
                        </div>

                        {/* Поля для файлов */}
                        {(sourceForm.type === 'csv' || sourceForm.type === 'excel') && (
                            <>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Файл</label>
                                    <input
                                        type="file"
                                        accept=".csv,.txt,.xlsx"
                                        onChange={handleFileUpload}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    {sourceForm.file_name && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            Загружен: {sourceForm.file_name}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Поля для SQL */}
                        {sourceForm.type === 'sql' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Хост *</label>
                                    <input
                                        type="text"
                                        value={sourceForm.host}
                                        onChange={(e) => setSourceForm({ ...sourceForm, host: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="localhost"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Порт</label>
                                    <input
                                        type="text"
                                        value={sourceForm.port}
                                        onChange={(e) => setSourceForm({ ...sourceForm, port: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="5432"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">База данных *</label>
                                    <input
                                        type="text"
                                        value={sourceForm.database}
                                        onChange={(e) => setSourceForm({ ...sourceForm, database: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="finengine"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Пользователь *</label>
                                    <input
                                        type="text"
                                        value={sourceForm.user}
                                        onChange={(e) => setSourceForm({ ...sourceForm, user: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="admin"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                                    <input
                                        type="password"
                                        value={sourceForm.password}
                                        onChange={(e) => setSourceForm({ ...sourceForm, password: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </>
                        )}

                        {/* Поля для API */}
                        {sourceForm.type === 'api' && (
                            <>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
                                    <input
                                        type="text"
                                        value={sourceForm.url}
                                        onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="https://api.example.com/v1"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ключ API</label>
                                    <input
                                        type="password"
                                        value={sourceForm.api_key}
                                        onChange={(e) => setSourceForm({ ...sourceForm, api_key: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="sk-..."
                                    />
                                </div>
                            </>
                        )}
                        {/* Поля для 1С */}
                        {sourceForm.type === '1c' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Формат выгрузки
                                    </label>
                                    <select
                                        value={sourceForm.file_format || 'csv'}
                                        onChange={(e) => setSourceForm({ ...sourceForm, file_format: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="csv">CSV файл</option>
                                        <option value="excel">Excel файл</option>
                                        <option value="xml">XML (CommerceML)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Файл выгрузки
                                    </label>
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Версия 1С
                                    </label>
                                    <select
                                        value={sourceForm.version_1c || '8.3'}
                                        onChange={(e) => setSourceForm({ ...sourceForm, version_1c: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="8.3">1С: 8.3</option>
                                        <option value="8.2">1С: 8.2</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Конфигурация
                                    </label>
                                    <select
                                        value={sourceForm.config_1c || 'accounting'}
                                        onChange={(e) => setSourceForm({ ...sourceForm, config_1c: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="accounting">Бухгалтерия</option>
                                        <option value="trade">Управление торговлей</option>
                                        <option value="unf">Управление нашей фирмой (УНФ)</option>
                                        <option value="complex">Комплексная</option>
                                        <option value="erp">ERP</option>
                                        <option value="retail">Розница</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleCreateSource}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                            Сохранить источник
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Сохранённые источники</h3>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                ) : sources.length === 0 ? (
                    <p className="text-gray-500">Нет сохранённых источников</p>
                ) : (
                    <div className="space-y-2">
                        {sources.map(source => {
                            let config: any = {};
                            try {
                                config = JSON.parse(source.config || '{}');
                            } catch (e) { }

                            return (
                                <div
                                    key={source.id}
                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedSource?.id === source.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    onClick={() => {
                                        setSelectedSource(source);
                                        setShowMapping(true);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">{source.name}</p>
                                            <p className="text-sm text-gray-500">
                                                Тип: {source.type}
                                                {config.file_name && ` • Файл: ${config.file_name}`}
                                                {config.host && ` • Хост: ${config.host}`}
                                                {config.url && ` • URL: ${config.url}`}
                                            </p>
                                        </div>
                                        <span className="text-sm text-gray-400">
                                            {selectedSource?.id === source.id ? 'Выбран' : 'Кликните для выбора'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
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