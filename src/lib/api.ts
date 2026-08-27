import { API_URL } from './config';

export type SheetName = 
  | 'Settings'
  | 'Companies'
  | 'Accounts'
  | 'Counterparties'
  | 'Transactions'
  | 'ExchangeRates'
  | 'Assets'
  | 'Loans';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async getAll(sheet: SheetName): Promise<any[]> {
    const url = `${this.baseUrl}?action=getAll&sheet=${sheet}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Ошибка при получении данных из ${sheet}:`, error);
      throw error;
    }
  }

  async create(sheet: SheetName, data: any): Promise<any> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          sheet: sheet,
          data: data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Ошибка при создании записи в ${sheet}:`, error);
      throw error;
    }
  }
}

export const api = new ApiClient(API_URL);