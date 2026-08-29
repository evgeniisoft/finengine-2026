/**
 * ============================================
 * FinEngine 2026 - Аутентификация
 * ============================================
 */

export interface Session {
  dbType: string;
  dbUrl: string;
  userEmail: string;
  userName: string;
  userRole: string;
  userId: string;
  companyId: string;
}

const SESSION_KEY = 'finengine_session';

/**
 * Хеширование пароля (SHA-256)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Сохранение сессии
 */
export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Получение сессии
 */
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Получение URL базы данных из сессии
 */
export function getDbUrl(): string {
  const session = getSession();
  return session?.dbUrl || '';
}

/**
 * Очистка сессии
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Проверка, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}