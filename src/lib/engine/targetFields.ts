import { TargetField, ImportTargetType } from './types';

/**
 * Справочник целевых полей для разных типов импорта
 */
export const targetFieldsByType: Record<ImportTargetType, TargetField[]> = {
  transactions: [
    { value: 'date', label: 'Дата', required: true, transform: 'parse_date' },
    { value: 'amount', label: 'Сумма', required: true, transform: 'parse_float' },
    { value: 'description', label: 'Описание', required: false },
    { value: 'currency', label: 'Валюта', required: false, transform: 'uppercase' },
    { value: 'company_id', label: 'Компания', required: false },
    { value: 'counterparty', label: 'Контрагент', required: false },
    { value: 'debit_account', label: 'Счёт дебета', required: false },
    { value: 'credit_account', label: 'Счёт кредита', required: false },
    { value: 'document_number', label: 'Номер документа', required: false },
  ],
  
  companies: [
    { value: 'name', label: 'Название', required: true },
    { value: 'inn', label: 'ИНН', required: false },
    { value: 'kpp', label: 'КПП', required: false },
    { value: 'tax_system', label: 'Система налогообложения', required: false },
  ],
  
  counterparties: [
    { value: 'name', label: 'Название', required: true },
    { value: 'inn', label: 'ИНН', required: false },
    { value: 'type', label: 'Тип (клиент/поставщик)', required: false },
    { value: 'phone', label: 'Телефон', required: false },
    { value: 'email', label: 'Email', required: false },
  ],
  
  accounts: [
    { value: 'code', label: 'Код счёта', required: true },
    { value: 'name', label: 'Название', required: true },
    { value: 'type', label: 'Тип (A/L/E/I/X)', required: false, transform: 'uppercase' },
    { value: 'is_cash_flow', label: 'Денежный счёт', required: false },
  ],
};

/**
 * Получение целевых полей для типа импорта
 */
export function getTargetFields(type: ImportTargetType): TargetField[] {
  return targetFieldsByType[type] || [];
}

/**
 * Трансформация значения
 */
export function transformValue(value: string, transform?: string): any {
  if (!transform) return value;
  
  switch (transform) {
    case 'parse_date':
      return normalizeDate(value);
    case 'parse_float':
      return parseFloat(String(value).replace(',', '.').replace(/\s/g, '')) || 0;
    case 'parse_int':
      return parseInt(String(value).replace(/\s/g, '')) || 0;
    case 'uppercase':
      return String(value).toUpperCase();
    default:
      return value;
  }
}

/**
 * Нормализация даты
 */
function normalizeDate(value: string): string {
  // DD.MM.YYYY
  const dotParts = value.split('.');
  if (dotParts.length === 3) {
    return `${dotParts[2]}-${dotParts[1]}-${dotParts[0]}`;
  }
  
  // DD/MM/YYYY
  const slashParts = value.split('/');
  if (slashParts.length === 3) {
    return `${slashParts[2]}-${slashParts[1]}-${slashParts[0]}`;
  }
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.substring(0, 10);
  }
  
  return value;
}