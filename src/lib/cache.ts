/**
 * ============================================
 * FinEngine 2026 - Кэширование данных
 * ============================================
 * Server-side in-memory кэш
 */

class DataCache {
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    this.cache.set(key, { 
      data, 
      expiresAt: Date.now() + ttlSeconds * 1000 
    });
  }

  invalidate(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const dataCache = new DataCache();

// Ключи кэша
export const CACHE_PREFIXES = {
  REPORTS: 'reports',
  BALANCE: 'balance',
  DIAGNOSTICS: 'diagnostics',
  DATA: 'data',
  USN_LIMITS: 'usn-limits',
};