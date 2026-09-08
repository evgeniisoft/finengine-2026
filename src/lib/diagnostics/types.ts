/**
 * ============================================
 * FinEngine 2026 - Типы для отображения диагностики
 * ============================================
 * Абстрактные типы, не привязанные к источнику данных
 */

export type DiagnosticDisplayType = 
  | 'progress_bar'   // Прогресс-бар с процентами
  | 'key_value'      // Ключ-значение
  | 'list'           // Список
  | 'table'          // Таблица
  | 'status'         // Статус с цветом
  | 'text';          // Простой текст

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

export interface DiagnosticEntity {
  entity: string;     // 'transactions', 'accounts', 'companies', 'budgets', 'settings'
  field?: string;     // Поле в сущности
  count?: number;     // Количество затронутых
  total_amount?: number;
  period?: {
    start: string;
    end: string;
  };
  display: DiagnosticDisplay;
}