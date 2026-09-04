/**
 * ============================================
 * FinEngine 2026 - Repository Pattern (DAL)
 * ============================================
 * Абстракция над источником данных.
 * Сейчас: Google Sheets через GAS
 * Потом: PostgreSQL
 */

export interface Repository {
  getAll(entity: string): Promise<any[]>;
  getById(entity: string, id: string): Promise<any>;
  create(entity: string, data: any): Promise<any>;
  update(entity: string, id: string, data: any): Promise<any>;
  delete(entity: string, id: string): Promise<boolean>;
  batchCreate(entity: string, dataArray: any[]): Promise<any>;
  deleteByHash(entity: string, hash: string): Promise<any>;
}

class SheetsRepository implements Repository {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.GAS_URL || 
      'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';
  }

  async getAll(entity: string): Promise<any[]> {
    const url = `${this.baseUrl}?action=getAll&sheet=${entity}`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getById(entity: string, id: string): Promise<any> {
    const url = `${this.baseUrl}?action=getById&sheet=${entity}&id=${encodeURIComponent(id)}`;
    const response = await fetch(url, { cache: 'no-store' });
    return response.json();
  }

  async create(entity: string, data: any): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', sheet: entity, data })
    });
    return response.json();
  }

  async update(entity: string, id: string, data: any): Promise<any> {
    const url = `${this.baseUrl}?action=update&sheet=${entity}&id=${encodeURIComponent(id)}&data=${encodeURIComponent(JSON.stringify(data))}`;
    const response = await fetch(url);
    return response.json();
  }

  async delete(entity: string, id: string): Promise<boolean> {
    const url = `${this.baseUrl}?action=delete&sheet=${entity}&id=${encodeURIComponent(id)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result.success || false;
  }

  async batchCreate(entity: string, dataArray: any[]): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batchCreate', sheet: entity, data: dataArray })
    });
    return response.json();
  }

  async deleteByHash(entity: string, hash: string): Promise<any> {
    const url = `${this.baseUrl}?action=deleteByHash&sheet=${entity}&hash=${encodeURIComponent(hash)}`;
    const response = await fetch(url);
    return response.json();
  }
}

class PostgresRepository implements Repository {
  // Будет реализовано при переходе на PostgreSQL
  // Использует Prisma или pg

  async getAll(entity: string): Promise<any[]> {
    throw new Error('PostgresRepository не реализован');
  }

  async getById(entity: string, id: string): Promise<any> {
    throw new Error('PostgresRepository не реализован');
  }

  async create(entity: string, data: any): Promise<any> {
    throw new Error('PostgresRepository не реализован');
  }

  async update(entity: string, id: string, data: any): Promise<any> {
    throw new Error('PostgresRepository не реализован');
  }

  async delete(entity: string, id: string): Promise<boolean> {
    throw new Error('PostgresRepository не реализован');
  }

  async batchCreate(entity: string, dataArray: any[]): Promise<any> {
    throw new Error('PostgresRepository не реализован');
  }

  async deleteByHash(entity: string, hash: string): Promise<any> {
    throw new Error('PostgresRepository не реализован');
  }
}

let repositoryInstance: Repository | null = null;

export function getRepository(): Repository {
  if (!repositoryInstance) {
    const dbType = process.env.DB_TYPE || 'sheets';
    
    if (dbType === 'postgresql') {
      repositoryInstance = new PostgresRepository();
    } else {
      repositoryInstance = new SheetsRepository();
    }
  }
  
  return repositoryInstance;
}

// Для обратной совместимости
export const repository = getRepository();