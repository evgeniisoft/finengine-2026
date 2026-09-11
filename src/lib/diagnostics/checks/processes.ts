/**
 * ============================================
 * Уровень 7: Процессы
 * ============================================
 */

import { DiagnosticContext, DiagnosticCheck } from '../types';
import { okCheck, problemCheck } from '../engine';

const LEVEL = 7 as const;
const CATEGORY = 'processes' as const;

export async function runProcessChecks(ctx: DiagnosticContext): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];

  // 7.1 Актуальность данных
  checks.push(checkDataFreshness(ctx));

  // 7.2 Компании без операций
  checks.push(checkCompaniesWithoutTransactions(ctx));

  // 7.3 Операции без описания
  checks.push(checkTransactionsWithoutDescription(ctx));

  return checks;
}

// ============================================
// 7.1 Актуальность данных
// ============================================
function checkDataFreshness(ctx: DiagnosticContext): DiagnosticCheck {
  const factTx = ctx.transactions.filter(t => t.record_type === 'fact' && t.date);

  if (factTx.length === 0) {
    return problemCheck(
      'data_freshness', LEVEL, CATEGORY, 'warning',
      'Актуальность данных',
      'Нет фактических операций',
      {
        reason: 'Все операции — плановые',
        recommendation: 'Добавьте фактические операции',
      }
    );
  }

  const lastDate = factTx
    .map(t => String(t.date).split('T')[0])
    .sort()
    .reverse()[0];

  const daysSince = Math.floor(
    (new Date(ctx.today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince > 30) {
    return problemCheck(
      'data_freshness', LEVEL, CATEGORY, 'warning',
      'Актуальность данных',
      `Последняя операция: ${daysSince} дн. назад (${lastDate})`,
      {
        details: { last_transaction: lastDate, days_ago: daysSince },
        reason: 'Данные давно не обновлялись',
        recommendation: 'Обновите данные или проверьте импорт',
        display: {
          type: 'key_value',
          items: [
            { label: 'Последняя операция', value: lastDate },
            { label: 'Дней назад', value: `${daysSince} дн.`, color: 'yellow' as const },
          ],
        },
      }
    );
  }

  if (daysSince > 7) {
    return problemCheck(
      'data_freshness', LEVEL, CATEGORY, 'info',
      'Актуальность данных',
      `Последняя операция: ${daysSince} дн. назад (${lastDate})`,
      {
        details: { last_transaction: lastDate, days_ago: daysSince },
        display: {
          type: 'key_value',
          items: [
            { label: 'Последняя операция', value: lastDate },
            { label: 'Дней назад', value: `${daysSince} дн.` },
          ],
        },
      }
    );
  }

  return okCheck(
    'data_freshness', LEVEL, CATEGORY,
    'Актуальность данных',
    `Последняя операция: ${daysSince === 0 ? 'сегодня' : `${daysSince} дн. назад`}`
  );
}

// ============================================
// 7.2 Компании без операций
// ============================================
function checkCompaniesWithoutTransactions(ctx: DiagnosticContext): DiagnosticCheck {
  const companiesWithTx = new Set(ctx.transactions.map(t => t.company_id));
  const emptyCompanies = ctx.companies.filter(c => !companiesWithTx.has(c.id));

  if (emptyCompanies.length === 0) {
    return okCheck(
      'companies_without_tx', LEVEL, CATEGORY,
      'Компании без операций',
      `Все ${ctx.companies.length} компаний имеют операции`
    );
  }

  return problemCheck(
    'companies_without_tx', LEVEL, CATEGORY, 'info',
    'Компании без операций',
    `${emptyCompanies.length} компаний без операций`,
    {
      count: emptyCompanies.length,
      details: { companies: emptyCompanies.map(c => ({ id: c.id, name: c.name })) },
      recommendation: 'Добавьте операции или удалите компании',
      display: {
        type: 'list',
        items: emptyCompanies.slice(0, 5).map(c => ({
          label: c.name,
          value: 'нет операций',
          color: 'gray' as const,
        })),
      },
    }
  );
}

// ============================================
// 7.3 Операции без описания
// ============================================
function checkTransactionsWithoutDescription(ctx: DiagnosticContext): DiagnosticCheck {
  const noDescription = ctx.transactions.filter(t => !t.description || String(t.description).trim() === '');

  if (noDescription.length === 0) {
    return okCheck(
      'transactions_without_description', LEVEL, CATEGORY,
      'Операции без описания',
      'Все операции имеют описание'
    );
  }

  return problemCheck(
    'transactions_without_description', LEVEL, CATEGORY, 'info',
    'Операции без описания',
    `${noDescription.length} операций без описания`,
    {
      count: noDescription.length,
      details: {
        items: noDescription.slice(0, 20).map(t => ({ id: t.id, date: t.date, amount: t.amount_rub })),
      },
      recommendation: 'Заполните описания для удобства работы',
    }
  );
}