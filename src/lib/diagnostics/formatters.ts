/**
 * Форматтеры для отображения деталей диагностики
 * Абстрактные — не зависят от источника данных
 */

import { DiagnosticDisplay, DiagnosticDisplayItem } from './types';

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' ₽';
}

export function formatPercent(percent: number): string {
  return percent.toFixed(1) + '%';
}

export function formatDate(date: string): string {
  if (!date) return '';
  if (date.length === 7) {
    // YYYY-MM
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
  return {
    type: 'progress_bar',
    title,
    percent,
    threshold,
    threshold_label: thresholdLabel
  };
}

export function createKeyValueDisplay(items: DiagnosticDisplayItem[]): DiagnosticDisplay {
  return {
    type: 'key_value',
    items
  };
}

export function createListDisplay(items: DiagnosticDisplayItem[]): DiagnosticDisplay {
  return {
    type: 'list',
    items
  };
}

export function createStatusDisplay(
  status: string,
  color: 'green' | 'yellow' | 'red' | 'gray'
): DiagnosticDisplay {
  return {
    type: 'status',
    title: status,
    percent: 0,
    threshold: 0,
    threshold_label: '',
    items: [{ label: 'Статус', value: status, color }]
  };
}