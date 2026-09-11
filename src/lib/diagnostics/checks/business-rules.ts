/**
 * ============================================
 * Уровень 5: Бизнес-правила
 * ============================================
 */

import { DiagnosticContext, DiagnosticCheck } from '../types';
import { okCheck, problemCheck } from '../engine';
import { taxEngine } from '@/lib/engine/tax';
import { calculator } from '@/lib/engine/calculator';

const LEVEL = 5 as const;
const CATEGORY = 'business_rules' as const;

export async function runBusinessRuleChecks(ctx: DiagnosticContext): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];

  // 5.1 Лимиты УСН
  checks.push(...checkUSNLimits(ctx));

  // 5.2 Кассовые разрывы
  checks.push(...checkCashGaps(ctx));

  // 5.3 Рентабельность
  checks.push(...checkProfitability(ctx));

  // 5.4 Дебиторка / Кредиторка
  checks.push(...checkARAP(ctx));

  return checks;
}

// ============================================
// 5.1 Лимиты УСН
// ============================================
function checkUSNLimits(ctx: DiagnosticContext): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  for (const company of ctx.companies) {
    if (company.tax_system !== 'USN_6' && company.tax_system !== 'USN_15') continue;

    const id = `usn_limits_${company.id}`;
    try {
      const limits = taxEngine.checkUSNLimits(company, ctx.transactions);

      if (limits.transition_required) {
        checks.push(problemCheck(
          id, LEVEL, CATEGORY, 'critical',
          `Переход на ОСНО: ${company.name}`,
          `Превышен лимит УСН. Переход с ${limits.transition_quarter}`,
          {
            entity: { type: 'company', id: company.id, name: company.name },
            count: 1,
            details: { limits },
            reason: 'Выручка превысила 490.5 млн ₽',
            recommendation: 'Срочно подайте уведомление о переходе на ОСНО',
            display: {
              type: 'progress_bar',
              title: 'Лимит УСН (490.5 млн)',
              percent: limits.limits.max.used_percent,
              threshold: limits.limits.max.threshold,
              threshold_label: 'Переход на ОСНО',
            },
          }
        ));
      } else if (limits.limits.max.used_percent > 80) {
        checks.push(problemCheck(
          id, LEVEL, CATEGORY, 'warning',
          `Приближение к лимиту УСН: ${company.name}`,
          `Использовано ${limits.limits.max.used_percent}% лимита`,
          {
            entity: { type: 'company', id: company.id, name: company.name },
            count: 1,
            details: { limits },
            recommendation: 'Планируйте переход на ОСНО',
            display: {
              type: 'progress_bar',
              title: 'Лимит УСН',
              percent: limits.limits.max.used_percent,
              threshold: limits.limits.max.threshold,
              threshold_label: 'Лимит',
            },
          }
        ));
      } else if (limits.vat_required) {
        checks.push(problemCheck(
          id, LEVEL, CATEGORY, 'warning',
          `НДС для УСН: ${company.name}`,
          `Выручка превысила 20 млн ₽. НДС ${(limits.vat_rate * 100).toFixed(0)}%`,
          {
            entity: { type: 'company', id: company.id, name: company.name },
            count: 1,
            details: { limits },
            recommendation: 'Начните учитывать НДС',
            display: {
              type: 'progress_bar',
              title: 'Порог НДС (20 млн)',
              percent: limits.limits.exempt.used_percent,
              threshold: limits.limits.exempt.threshold,
              threshold_label: `НДС ${(limits.vat_rate * 100).toFixed(0)}%`,
            },
          }
        ));
      } else {
        checks.push(okCheck(
          id, LEVEL, CATEGORY,
          `Лимиты УСН: ${company.name}`,
          `Выручка ${limits.current_revenue.toLocaleString('ru-RU')} ₽ (${limits.limits.exempt.used_percent}% от порога НДС)`
        ));
      }
    } catch (e: any) {
      checks.push(problemCheck(
        id, LEVEL, CATEGORY, 'warning',
        `Лимиты УСН: ${company.name}`,
        `Ошибка: ${e.message}`,
        {
          entity: { type: 'company', id: company.id, name: company.name },
          reason: e.message,
        }
      ));
    }
  }

  return checks;
}

// ============================================
// 5.2 Кассовые разрывы
// ============================================
function checkCashGaps(ctx: DiagnosticContext): DiagnosticCheck[] {
  const id = 'cash_gaps';

  try {
    // Текущий остаток на СЕГОДНЯ (не на конец года)
    const currentBalance = ctx.companies.reduce((s, c) =>
      s + calculator.calculateBalanceSheet(ctx.transactions, ctx.accounts, c.id, ctx.today, c).assets.cash, 0);

    // Будущие операции (только fact)
    const futureTx = ctx.transactions
      .filter(t => {
        const d = String(t.date).split('T')[0];
        return d >= ctx.today && t.record_type === 'fact';
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    let projectedCash = currentBalance;
    const gaps: { date: string; deficit: number }[] = [];

    for (const t of futureTx) {
      const amount = parseFloat(String(t.amount_rub || 0));
      if (t.type === 'income') projectedCash += amount;
      if (t.type === 'expense') projectedCash -= amount;

      if (projectedCash < 0) {
        const d = String(t.date).split('T')[0];
        gaps.push({ date: d, deficit: Math.abs(projectedCash) });
      }
    }

    if (gaps.length > 0) {
      return [problemCheck(
        id, LEVEL, CATEGORY, 'critical',
        'Кассовые разрывы',
        `${gaps.length} кассовых разрывов в прогнозе`,
        {
          count: gaps.length,
          details: { gaps: gaps.slice(0, 20), current_balance: currentBalance },
          reason: 'Прогнозный остаток становится отрицательным',
          recommendation: 'Перенесите платежи или привлеките финансирование',
          display: {
            type: 'list',
            items: gaps.slice(0, 5).map(g => ({
              label: g.date,
              value: `-${g.deficit.toLocaleString('ru-RU')} ₽`,
              color: 'red' as const,
            })),
          },
        }
      )];
    }

    return [okCheck(id, LEVEL, CATEGORY, 'Кассовые разрывы', `Кассовых разрывов нет (остаток: ${currentBalance.toLocaleString('ru-RU')} ₽)`)];
  } catch (e: any) {
    return [problemCheck(id, LEVEL, CATEGORY, 'warning', 'Кассовые разрывы', `Ошибка: ${e.message}`, { reason: e.message })];
  }
}

// ============================================
// 5.3 Рентабельность
// ============================================
function checkProfitability(ctx: DiagnosticContext): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  for (const company of ctx.companies) {
    const id = `profitability_${company.id}`;
    try {
      const pnl = calculator.calculatePnL(
        ctx.transactions, ctx.accounts, company.id,
        ctx.periodStart, ctx.periodEnd, company
      );

      const margin = pnl.revenue > 0 ? (pnl.net_profit / pnl.revenue) * 100 : 0;

      if (margin < -20) {
        checks.push(problemCheck(
          id, LEVEL, CATEGORY, 'warning',
          `Убыточность: ${company.name}`,
          `Убыток ${margin.toFixed(1)}% (${pnl.net_profit.toLocaleString('ru-RU')} ₽)`,
          {
            entity: { type: 'company', id: company.id, name: company.name },
            details: { revenue: pnl.revenue, net_profit: pnl.net_profit, margin },
            reason: 'Убыток больше 20% от выручки',
            recommendation: 'Проанализируйте структуру расходов',
          }
        ));
      } else {
        checks.push(okCheck(
          id, LEVEL, CATEGORY,
          `Рентабельность: ${company.name}`,
          `${margin.toFixed(1)}% (прибыль ${pnl.net_profit.toLocaleString('ru-RU')} ₽)`
        ));
      }
    } catch (e: any) {
      checks.push(problemCheck(
        id, LEVEL, CATEGORY, 'warning',
        `Рентабельность: ${company.name}`,
        `Ошибка: ${e.message}`,
        { reason: e.message }
      ));
    }
  }

  return checks;
}

// ============================================
// 5.4 Дебиторка / Кредиторка
// ============================================
function checkARAP(ctx: DiagnosticContext): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  const arAcc = ctx.systemAccounts?.ar || 'acc-ar-001';
  const apAcc = ctx.systemAccounts?.ap || 'acc-ap-001';

  const ar = ctx.transactions
    .filter(t => t.debit_account_id === arAcc)
    .reduce((s, t) => s + parseFloat(String(t.amount_rub || 0)), 0)
    - ctx.transactions
      .filter(t => t.credit_account_id === arAcc)
      .reduce((s, t) => s + parseFloat(String(t.amount_rub || 0)), 0);

  const ap = ctx.transactions
    .filter(t => t.credit_account_id === apAcc)
    .reduce((s, t) => s + parseFloat(String(t.amount_rub || 0)), 0)
    - ctx.transactions
      .filter(t => t.debit_account_id === apAcc)
      .reduce((s, t) => s + parseFloat(String(t.amount_rub || 0)), 0);

  if (ar > 1000000) {
    checks.push(problemCheck(
      'ar_balance', LEVEL, CATEGORY, 'warning',
      'Дебиторская задолженность',
      `Дебиторка: ${ar.toLocaleString('ru-RU')} ₽`,
      {
        details: { balance: ar },
        recommendation: 'Проверьте просроченную дебиторку',
        display: {
          type: 'key_value',
          items: [{ label: 'Дебиторская задолженность', value: `${ar.toLocaleString('ru-RU')} ₽`, bold: true }],
        },
      }
    ));
  } else if (ar > 0) {
    checks.push(okCheck('ar_balance', LEVEL, CATEGORY, 'Дебиторская задолженность', `${ar.toLocaleString('ru-RU')} ₽`));
  } else {
    checks.push(okCheck('ar_balance', LEVEL, CATEGORY, 'Дебиторская задолженность', 'Дебиторки нет'));
  }

  if (ap > 1000000) {
    checks.push(problemCheck(
      'ap_balance', LEVEL, CATEGORY, 'warning',
      'Кредиторская задолженность',
      `Кредиторка: ${ap.toLocaleString('ru-RU')} ₽`,
      {
        details: { balance: ap },
        recommendation: 'Проверьте сроки оплаты',
        display: {
          type: 'key_value',
          items: [{ label: 'Кредиторская задолженность', value: `${ap.toLocaleString('ru-RU')} ₽`, bold: true }],
        },
      }
    ));
  } else if (ap > 0) {
    checks.push(okCheck('ap_balance', LEVEL, CATEGORY, 'Кредиторская задолженность', `${ap.toLocaleString('ru-RU')} ₽`));
  } else {
    checks.push(okCheck('ap_balance', LEVEL, CATEGORY, 'Кредиторская задолженность', 'Кредиторки нет'));
  }

  return checks;
}