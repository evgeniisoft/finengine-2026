/**
 * ============================================
 * FinEngine 2026 - Модуль импорта данных
 * ============================================
 * Импорт из CSV, Excel, 1С.
 * Маппинг счетов и валидация данных.
 */

import { Transaction, Account, Company, Counterparty } from './types';

export interface ImportMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: any) => any;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  transactions: Transaction[];
}

export class ImportEngine {
  
  /**
   * Импорт из CSV
   */
  importCSV(
    csvContent: string,
    mapping: ImportMapping[],
    companyId: string,
    accounts: Account[]
  ): ImportResult {
    
    const errors: string[] = [];
    const transactions: Transaction[] = [];
    let imported = 0;
    let skipped = 0;
    
    try {
      // Парсим CSV
      const rows = this.parseCSV(csvContent);
      
      if (rows.length < 2) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['Файл пустой или содержит только заголовки'],
          transactions: []
        };
      }
      
      // Первая строка — заголовки
      const headers = rows[0];
      
      // Проверяем, что все колонки из маппинга есть в файле
      for (const map of mapping) {
        if (!headers.includes(map.sourceColumn)) {
          errors.push(`Колонка "${map.sourceColumn}" не найдена в файле`);
        }
      }
      
      if (errors.length > 0) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors,
          transactions: []
        };
      }
      
      // Обрабатываем каждую строку
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawData: any = {};
        
        // Применяем маппинг
        for (const map of mapping) {
          const columnIndex = headers.indexOf(map.sourceColumn);
          const value = row[columnIndex] || '';
          rawData[map.targetField] = map.transform ? map.transform(value) : value;
        }
        
        // Валидация
        const validationError = this.validateTransaction(rawData);
        if (validationError) {
          skipped++;
          errors.push(`Строка ${i + 1}: ${validationError}`);
          continue;
        }
        
        // Создаём транзакцию
        const transaction = this.createTransactionFromImport(
          rawData,
          companyId,
          accounts
        );
        
        transactions.push(transaction);
        imported++;
      }
      
      return {
        success: imported > 0,
        imported,
        skipped,
        errors,
        transactions
      };
      
    } catch (error) {
      return {
        success: false,
        imported,
        skipped,
        errors: [...errors, `Ошибка парсинга: ${error}`],
        transactions
      };
    }
  }
  
  /**
   * Импорт из Excel (через CSV)
   * Для Excel нужна конвертация в CSV на клиенте
   */
  importExcel(
    rows: string[][],
    mapping: ImportMapping[],
    companyId: string,
    accounts: Account[]
  ): ImportResult {
    
    // Конвертируем rows в CSV формат
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    return this.importCSV(csvContent, mapping, companyId, accounts);
  }
  
  /**
   * Импорт из 1С (CSV экспорт)
   * 1С может экспортировать в CSV. Используем специальный маппинг.
   */
  importFrom1C(
    csvContent: string,
    companyId: string,
    accounts: Account[]
  ): ImportResult {
    
    // Стандартный маппинг для 1С
    const mapping: ImportMapping[] = [
      { sourceColumn: 'Дата', targetField: 'date' },
      { sourceColumn: 'Счет Дт', targetField: 'debit_account' },
      { sourceColumn: 'Счет Кт', targetField: 'credit_account' },
      { sourceColumn: 'Сумма', targetField: 'amount', transform: (v) => parseFloat(v.replace(',', '.')) },
      { sourceColumn: 'Валюта', targetField: 'currency', transform: (v) => v || 'RUB' },
      { sourceColumn: 'Содержание', targetField: 'description' },
      { sourceColumn: 'Контрагент', targetField: 'counterparty' }
    ];
    
    return this.importCSV(csvContent, mapping, companyId, accounts);
  }
  
  /**
   * Парсинг CSV
   */
  private parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else if (char === '\r' && nextChar === '\n') {
        // Пропускаем \r\n
        i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    
    // Последняя строка
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }
    
    // Фильтруем пустые строки
    return rows.filter(row => row.some(cell => cell.trim() !== ''));
  }
  
  /**
   * Валидация импортированной транзакции
   */
  private validateTransaction(data: any): string | null {
    
    if (!data.date) return 'Отсутствует дата';
    if (!data.amount || isNaN(data.amount)) return 'Некорректная сумма';
    if (data.amount <= 0) return 'Сумма должна быть больше 0';
    if (!data.description) return 'Отсутствует описание';
    
    // Проверка формата даты
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      // Пробуем преобразовать из DD.MM.YYYY
      const parts = data.date.split('.');
      if (parts.length === 3) {
        data.date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        return 'Некорректный формат даты (ожидается YYYY-MM-DD)';
      }
    }
    
    return null;
  }
  
  /**
   * Создание транзакции из импортированных данных
   */
  private createTransactionFromImport(
    data: any,
    companyId: string,
    accounts: Account[]
  ): Transaction {
    
    // Маппинг счетов
    const debitAccount = this.mapAccount(data.debit_account || 'acc-bank-001', accounts);
    const creditAccount = this.mapAccount(data.credit_account || 'acc-bank-001', accounts);
    
    return {
      id: this.generateId(),
      transaction_group_id: this.generateId(),
      date: data.date,
      company_id: companyId,
      description: data.description || 'Импортированная операция',
      amount: data.amount,
      currency: data.currency || 'RUB',
      amount_rub: data.amount, // Пока 1:1, потом курс
      counterparty_id: data.counterparty || '',
      contract_id: '',
      debit_account_id: debitAccount,
      credit_account_id: creditAccount,
      is_system: false
    };
  }
  
  /**
   * Маппинг счетов из 1С в наши счета
   */
  private mapAccount(sourceAccount: string, accounts: Account[]): string {
    
    // Маппинг стандартных счетов 1С
    const accountMapping: { [key: string]: string } = {
      '51': 'acc-bank-001',    // Расчётный счёт
      '50': 'acc-bank-001',    // Касса
      '62': 'acc-ar-001',      // Расчёты с покупателями
      '60': 'acc-ap-001',      // Расчёты с поставщиками
      '90.01': 'acc-rev-001',  // Выручка
      '90.02': 'acc-exp-cogs', // Себестоимость
      '26': 'acc-exp-001',     // Общехозяйственные расходы
      '44': 'acc-exp-001',     // Расходы на продажу
      '66': 'acc-loans',       // Краткосрочные кредиты
      '67': 'acc-loans',       // Долгосрочные кредиты
      '01': 'acc-fixed-assets', // Основные средства
      '02': 'acc-depreciation', // Амортизация
      '10': 'acc-inventory',   // Материалы
      '41': 'acc-inventory',   // Товары
    };
    
    // Прямой маппинг
    if (accountMapping[sourceAccount]) {
      return accountMapping[sourceAccount];
    }
    
    // Поиск по коду
    const account = accounts.find(a => a.code === sourceAccount);
    if (account) return account.id;
    
    // Поиск по имени (частичное совпадение)
    const accountByName = accounts.find(a => 
      a.name.toLowerCase().includes(sourceAccount.toLowerCase())
    );
    if (accountByName) return accountByName.id;
    
    // По умолчанию — банк
    return 'acc-bank-001';
  }
  
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const importEngine = new ImportEngine();