/**
 * ============================================
 * FinEngine 2026 - Модуль бюджетирования
 * ============================================
 * Скользящее планирование, сравнение Факт/План,
 * калибровка на основе исторических данных.
 */

import { Budget, Transaction, Account } from './types';

export class BudgetEngine {

  /**
   * Автозаполнение бюджета на основе исторических данных
   * Логика:
   * 1. Ищем данные за прошлый год (если бюджетируем 2026 — ищем 2025)
   * 2. Если прошлого года нет — используем текущий год (до текущего месяца)
   * 3. Если ничего нет — возвращаем пустой массив
   */
  autoFillBudget(
    companyId: string,
    year: string,
    accounts: Account[],
    transactions: Transaction[]
  ): Budget[] {

    const budgets: Budget[] = [];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    // Определяем дату, до которой считаем данные "историческими"
    const now = new Date();
    const previousYear = String(parseInt(year) - 1);

    // Вариант 1: прошлый год
    let historicalTx = transactions.filter(t => {
      const txDate = this.getDateStr(t.date);
      return t.company_id === companyId &&
        txDate.startsWith(previousYear) &&
        (t.debit_account_id || t.credit_account_id);
    });

    // Проверяем, есть ли данные по доходным/расходным счетам
    const hasIncomeExpenseData = historicalTx.some(t => {
      const account = accounts.find(a => a.id === t.debit_account_id || a.id === t.credit_account_id);
      return account && (account.type === 'I' || account.type === 'X');
    });

    if (!hasIncomeExpenseData) {
      const currentMonth = now.toISOString().substring(0, 7);
      historicalTx = transactions.filter(t => {
        const txDate = this.getDateStr(t.date);
        return t.company_id === companyId &&
          txDate.startsWith(year) &&
          txDate < currentMonth &&
          (t.debit_account_id || t.credit_account_id);
      });
    }

    if (historicalTx.length === 0) {
      return []; // Нет данных — пользователь заполнит вручную
    }

    // Для каждой статьи считаем средние значения
    for (const account of accounts) {
      if (account.type !== 'I' && account.type !== 'X') continue;

      // Операции по конкретному счёту
      const accountTx = historicalTx.filter(t =>
        t.debit_account_id === account.id || t.credit_account_id === account.id
      );

      if (accountTx.length === 0) continue;

      // Группируем по месяцам
      const monthlyGroups = new Map<string, number>();
      for (const tx of accountTx) {
        const txDate = this.getDateStr(tx.date);
        const month = txDate.substring(0, 7);
        const amount = parseFloat(String(tx.amount || 0));
        monthlyGroups.set(month, (monthlyGroups.get(month) || 0) + amount);
      }

      const averages = Array.from(monthlyGroups.values());
      if (averages.length === 0) continue;

      const avg = averages.reduce((s, v) => s + v, 0) / averages.length;

      // Сезонные коэффициенты
      const seasonality = this.calculateSeasonality(monthlyGroups);

      // Создаём бюджеты на 12 месяцев
      for (const month of months) {
        const monthNum = parseInt(month);
        const seasonalFactor = seasonality[monthNum] || 1;
        const plannedAmount = avg * seasonalFactor;

        budgets.push({
          id: this.generateId(),
          tenant_id: 'tenant-1',
          company_id: companyId,
          category_id: account.id,
          account_id: account.id,
          period: `${year}-${month}`,
          planned_amount: Math.round(plannedAmount * 100) / 100,
          actual_amount: 0,
          record_type: 'pnl',
          scenario: 'base',
          status: 'draft',
          payment_delay_days: 0,
          is_deleted: '',
          deleted_at: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    return budgets;
  }

  /**
   * Создание бюджета на 12 месяцев (скользящее планирование)
   */
  createRollingBudget(
    companyId: string,
    startMonth: string,
    accounts: Account[],
    historicalTransactions: Transaction[]
  ): Budget[] {

    const budgets: Budget[] = [];
    const months = this.getNextMonths(startMonth, 12);

    for (const month of months) {
      for (const account of accounts) {
        if (account.type === 'I' || account.type === 'X') {
          const baseAmount = this.calculateBaseAmount(account.id, month, historicalTransactions);

          budgets.push({
            id: this.generateId(),
            tenant_id: 'tenant-1',
            company_id: companyId,
            category_id: account.id,
            account_id: account.id,
            period: month,
            planned_amount: baseAmount,
            actual_amount: 0,
            record_type: 'pnl',
            scenario: 'base',
            status: 'draft',
            payment_delay_days: 0,
            is_deleted: '',
            deleted_at: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    return budgets;
  }

  /**
   * Расчёт сезонных коэффициентов
   */
  private calculateSeasonality(monthlyGroups: Map<string, number>): { [month: number]: number } {
    const values = Array.from(monthlyGroups.values());
    const avg = values.reduce((s, v) => s + v, 0) / values.length;

    const factors: { [month: number]: number } = {};
    for (const [monthStr, value] of monthlyGroups) {
      const month = parseInt(monthStr.split('-')[1]);
      factors[month] = avg > 0 ? value / avg : 1;
    }
    return factors;
  }

  /**
   * Расчёт базовой суммы для бюджета на основе историчности
   */
  private calculateBaseAmount(
    accountId: string,
    month: string,
    transactions: Transaction[]
  ): number {

    const historical = transactions.filter(t => {
      const tMonth = this.getDateStr(t.date).substring(0, 7);
      return tMonth < month &&
        (t.debit_account_id === accountId || t.credit_account_id === accountId);
    });

    if (historical.length === 0) return 0;

    const last3Months = this.getLastMonths(month, 3);
    const recent = historical.filter(t => {
      const tMonth = this.getDateStr(t.date).substring(0, 7);
      return last3Months.includes(tMonth);
    });

    const base = recent.length > 0 ? recent : historical;
    const total = base.reduce((sum, t) => sum + parseFloat(String(t.amount_rub || 0)), 0);

    return total / base.length;
  }

  /**
   * Сравнение Факт vs План
   */
  compareBudgetVsActual(
    budgets: Budget[],
    transactions: Transaction[],
    accounts: Account[]
  ): Budget[] {

    return budgets.map(budget => {
      const actualTransactions = transactions.filter(t => {
        const tMonth = this.getDateStr(t.date).substring(0, 7);
        return tMonth === budget.period &&
          (t.debit_account_id === budget.account_id || t.credit_account_id === budget.account_id);
      });

      let actualAmount = 0;
      for (const t of actualTransactions) {
        const account = accounts.find(a => a.id === budget.account_id);
        if (!account) continue;

        if (account.type === 'I') {
          if (t.credit_account_id === budget.account_id) {
            actualAmount += parseFloat(String(t.amount_rub || 0));
          }
        } else if (account.type === 'X') {
          if (t.debit_account_id === budget.account_id) {
            actualAmount += parseFloat(String(t.amount_rub || 0));
          }
        }
      }

      return { ...budget, actual_amount: actualAmount };
    });
  }

  /**
   * Калибровка бюджета на основе отклонений
   */
  calibrateBudget(budgets: Budget[], currentMonth: string): Budget[] {
    return budgets.map(budget => {
      if (budget.period > currentMonth) {
        const lastClosedMonth = this.getPreviousMonth(currentMonth);
        const lastBudget = budgets.find(b =>
          b.period === lastClosedMonth && b.account_id === budget.account_id
        );

        if (lastBudget && lastBudget.planned_amount > 0) {
          const deviation = lastBudget.actual_amount / lastBudget.planned_amount;
          return {
            ...budget,
            planned_amount: Math.round(budget.planned_amount * deviation * 100) / 100
          };
        }
      }
      return budget;
    });
  }

  /**
   * Вспомогательные функции
   */
  private getDateStr(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') return date.split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return String(date).split('T')[0];
  }

  private getNextMonths(startMonth: string, count: number): string[] {
    const months: string[] = [];
    const [year, month] = startMonth.split('-').map(Number);

    for (let i = 0; i < count; i++) {
      const date = new Date(year, month - 1 + i, 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
    }
    return months;
  }

  private getLastMonths(month: string, count: number): string[] {
    const months: string[] = [];
    const [year, monthNum] = month.split('-').map(Number);

    for (let i = 1; i <= count; i++) {
      const date = new Date(year, monthNum - 1 - i, 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
    }
    return months;
  }

  private getPreviousMonth(month: string): string {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 2, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const budgetEngine = new BudgetEngine();