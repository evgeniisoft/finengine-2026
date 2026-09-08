/**
 * ============================================
 * FinEngine 2026 - Кэширование данных
 * ============================================
 */

class DataCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(key: string, data: any, ttlSeconds?: number): void {
    this.cache.set(key, { 
      data, 
      timestamp: Date.now() + (ttlSeconds ? ttlSeconds * 1000 : 0) 
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

export const dataCache = new DataCache(300); // 5 минут TTL по умолчанию

// Ключи кэша
export const CACHE_KEYS = {
  ACCOUNTS: 'accounts',
  COMPANIES: 'companies',
  SETTINGS: 'settings',
  COUNTERPARTIES: 'counterparties',
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
};