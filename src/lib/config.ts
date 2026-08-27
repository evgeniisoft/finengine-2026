/**
 * Конфигурация приложения FinEngine 2026
 */

// URL для API прокси (относительный путь)
export const API_URL = '/api/proxy';

// URL Google Apps Script (берём из переменных окружения)
export const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

// Настройки приложения
export const APP_CONFIG = {
  appName: 'FinEngine 2026',
  version: '0.1.0',
  defaultCurrency: 'RUB',
};