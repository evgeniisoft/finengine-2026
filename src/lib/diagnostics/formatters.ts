/**
 * ============================================
 * FinEngine 2026 - Форматтеры диагностики
 * ============================================
 */

import { DiagnosticDisplay, DiagnosticDisplayItem } from './types';

export function formatCurrency(amount: number): string {
  if (!isFinite(amount)) return '—';
  return amount.toLocaleString('ru-RU') + ' ₽';
}

export function formatPercent(percent: number): string {
  if (!isFinite(percent)) return '—';
  return percent.toFixed(1) + '%';
}

export function formatDate(date: string): string {
  if (!date) return '';
  if (date.length === 7) {
    const [year, month] = date.split('-');
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  return date;
}

export function createProgressDisplay(
  title: string,
  percent: number,
  threshold: number,
  thresholdLabel: string
): DiagnosticDisplay {
  return { type: 'progress_bar', title, percent, threshold, threshold_label: thresholdLabel };
}

export function createKeyValueDisplay(items: DiagnosticDisplayItem[]): DiagnosticDisplay {
  return { type: 'key_value', items };
}

export function createListDisplay(items: DiagnosticDisplayItem[]): DiagnosticDisplay {
  return { type: 'list', items };
}

export function createStatusDisplay(
  status: string,
  color: 'green' | 'yellow' | 'red' | 'gray'
): DiagnosticDisplay {
  return {
    type: 'status',
    title: status,
    items: [{ label: 'Статус', value: status, color }]
  };
}

/**
 * Автоматически подобрать цвет по проценту
 */
export function percentColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent > 80) return 'red';
  if (percent > 60) return 'yellow';
  return 'green';
}

/**
 * Форматирование разницы для consistency-проверок
 */
export function formatDiff(diff: number): string {
  if (Math.abs(diff) < 1) return '0 ₽';
  const sign = diff > 0 ? '+' : '';
  return sign + diff.toLocaleString('ru-RU') + ' ₽';
}