/**
 * ============================================
 * FinEngine 2026 - API Client
 * ============================================
 * Все запросы идут через /api/data (Next.js API Route).
 * Нет прямых запросов к GAS — нет CORS проблем.
 */

export type SheetName = 
  | 'Settings'
  | 'Companies'
  | 'Accounts'
  | 'Counterparties'
  | 'Transactions'
  | 'JournalEntries'
  | 'Budgets'
  | 'ExchangeRates'
  | 'Assets'
  | 'Loans'
  | 'DatabaseConnections'
  | 'AuditLog'
  | 'Users'
  | 'Notifications'
  | 'DataSources'
  | 'DataMappings';

class ApiClient {
  private baseUrl = '/api/data';

  async getAll(sheet: SheetName): Promise<any[]> {
    try {
      const url = `${this.baseUrl}?action=getAll&sheet=${sheet}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.error) {
        throw new Error(data.error);
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Ошибка при получении данных из ${sheet}:`, error);
      throw error;
    }
  }

  async getById(sheet: SheetName, id: string): Promise<any> {
    try {
      const url = `${this.baseUrl}?action=getById&sheet=${sheet}&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      console.error(`Ошибка при получении записи из ${sheet}:`, error);
      throw error;
    }
  }

  async create(sheet: SheetName, data: any): Promise<any> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', sheet, data })
      });

      const result = await response.json();
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Ошибка при создании записи в ${sheet}:`, error);
      throw error;
    }
  }

  async update(sheet: SheetName, id: string, data: any): Promise<any> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', sheet, id, data })
      });

      const result = await response.json();
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Ошибка при обновлении записи в ${sheet}:`, error);
      throw error;
    }
  }

  async delete(sheet: SheetName, id: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}?action=delete&sheet=${sheet}&id=${id}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result.success || false;
    } catch (error) {
      console.error(`Ошибка при удалении записи из ${sheet}:`, error);
      throw error;
    }
  }

  async batchCreate(sheet: SheetName, dataArray: any[]): Promise<any> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batchCreate', sheet, data: dataArray })
      });

      const result = await response.json();
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Ошибка при массовом создании в ${sheet}:`, error);
      throw error;
    }
  }

  // Установка URL API
  async setApiUrl(url: string): Promise<void> {
    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_url', url })
      });
    } catch (error) {
      console.error('Ошибка при установке URL:', error);
      throw error;
    }
  }

  // Получение текущего URL
  async getApiUrl(): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_url' })
      });
      const data = await response.json();
      return data.url || '';
    } catch (error) {
      console.error('Ошибка при получении URL:', error);
      return '';
    }
  }
}

export const api = new ApiClient();