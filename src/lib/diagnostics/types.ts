/**
 * ============================================
 * FinEngine 2026 - Типы диагностики
 * ============================================
 */

// ============================================
// Уровни диагностики
// ============================================
export type DiagnosticLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const LEVEL_NAMES: Record<DiagnosticLevel, string> = {
  1: 'Целостность данных',
  2: 'Настройки',
  3: 'Формулы',
  4: 'Согласованность отчётов',
  5: 'Бизнес-правила',
  6: 'Инфраструктура',
  7: 'Процессы',
};

// ============================================
// Категории
// ============================================
export type DiagnosticCategory =
  | 'data_integrity'
  | 'settings'
  | 'calculations'
  | 'consistency'
  | 'business_rules'
  | 'infrastructure'
  | 'processes';

export const CATEGORY_LABELS: Record<DiagnosticCategory, string> = {
  data_integrity: 'Целостность данных',
  settings: 'Настройки',
  calculations: 'Формулы',
  consistency: 'Согласованность отчётов',
  business_rules: 'Бизнес-правила',
  infrastructure: 'Инфраструктура',
  processes: 'Процессы',
};

// ============================================
// Severity
// ============================================
export type DiagnosticSeverity = 'critical' | 'warning' | 'info' | 'ok';

export const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  critical: 'Критично',
  warning: 'Предупреждение',
  info: 'Инфо',
  ok: 'ОК',
};

// ============================================
// Сравнение (для consistency-проверок)
// ============================================
export interface DiagnosticComparison {
  metric: string;
  expected_value: number | string;
  actual_value: number | string;
  expected_source: string;
  actual_source: string;
  difference: number;
  difference_percent: number;
  threshold: number;
}

// ============================================
// Auto-fix
// ============================================
export interface AutoFixInfo {
  title: string;
  description: string;
  impact: string;
  risk: 'Низкий риск' | 'Средний риск' | 'Высокий риск' | string;
}

// ============================================
// Проверка
// ============================================
export interface DiagnosticCheck {
  // Идентификация
  id: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  level: DiagnosticLevel;

  // Название
  name: string;
  message: string;

  // Сравнение (опционально)
  comparison?: DiagnosticComparison;

  // Контекст
  entity?: {
    type: 'company' | 'transaction' | 'account' | 'budget' | 'settings';
    id?: string;
    name?: string;
  };
  period?: {
    start: string;
    end: string;
  };

  // Детали
  count?: number;
  details?: any;
  display?: DiagnosticDisplay;

  // Действия
  reason?: string | null;
  recommendation?: string | null;
  auto_fix?: boolean;
  auto_fix_action?: string;
  auto_fix_data?: any[];
  auto_fix_info?: AutoFixInfo;
}

// ============================================
// Отображение
// ============================================
export type DiagnosticDisplayType =
  | 'progress_bar'
  | 'key_value'
  | 'list'
  | 'table'
  | 'status'
  | 'text';

export interface DiagnosticDisplayItem {
  label: string;
  value: string | number;
  color?: 'green' | 'yellow' | 'red' | 'gray';
  bold?: boolean;
}

export interface DiagnosticDisplay {
  type: DiagnosticDisplayType;
  title?: string;
  items?: DiagnosticDisplayItem[];
  percent?: number;
  threshold?: number;
  threshold_label?: string;
}

// ============================================
// Итог
// ============================================
export interface DiagnosticsSummary {
  total_checks: number;
  critical: number;
  warnings: number;
  ok: number;
  info: number;
  health_score: number;
}

export interface DiagnosticsByCategory {
  [category: string]: {
    total: number;
    critical: number;
    warning: number;
    ok: number;
    info: number;
  };
}

export interface DiagnosticsByLevel {
  [level: string]: {
    total: number;
    critical: number;
    warning: number;
  };
}

export interface DiagnosticsContext {
  period_start: string;
  period_end: string;
  companies_count: number;
  transactions_count: number;
  gas_load_time: number;
}

export interface DiagnosticsResult {
  timestamp: string;
  execution_time: number;
  summary: DiagnosticsSummary;
  by_category: DiagnosticsByCategory;
  by_level: DiagnosticsByLevel;
  context: DiagnosticsContext;
  checks: DiagnosticCheck[];
}

// ============================================
// Контекст для движка
// ============================================
export interface DiagnosticContext {
  // Данные
  transactions: any[];
  accounts: any[];
  companies: any[];
  counterparties: any[];
  budgets: any[];
  settings: any;
  systemAccounts: any;

  // Период
  periodStart: string;
  periodEnd: string;
  today: string;

  // Метаданные
  startTime: number;
  gasLoadTime: number;

  // Опции
  options: {
    checkConsistency: boolean;
    checkInfrastructure: boolean;
    checkBusinessRules: boolean;
  };
}