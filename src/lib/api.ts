import { API_URL } from './config';

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

// Переменная для хранения активного URL
let activeApiUrl: string = API_URL;

/**
 * Установка активного URL API
 */
export function setActiveApiUrl(url: string) {
  if (url && url.trim()) {
    activeApiUrl = url.trim();
    console.log('API URL обновлён:', activeApiUrl);
  }
}

/**
 * Получение активного URL API
 */
export function getActiveApiUrl(): string {
  return activeApiUrl;
}

class ApiClient {
  private get baseUrl(): string {
    return getActiveApiUrl();
  }

  async getAll(sheet: SheetName): Promise<any[]> {
    const url = `${this.baseUrl}?action=getAll&sheet=${sheet}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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

  async create(sheet: SheetName, data: any): Promise<any> {
    try {
      const jsonData = JSON.stringify(data);
      const url = `${this.baseUrl}?action=create&sheet=${sheet}&data=${encodeURIComponent(jsonData)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      const jsonData = JSON.stringify(data);
      const url = `${this.baseUrl}?action=update&sheet=${sheet}&id=${id}&data=${encodeURIComponent(jsonData)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      const jsonData = JSON.stringify(dataArray);
      const url = `${this.baseUrl}?action=batchCreate&sheet=${sheet}&data=${encodeURIComponent(jsonData)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Ошибка при массовом создании записей в ${sheet}:`, error);
      throw error;
    }
  }
}

export const api = new ApiClient();