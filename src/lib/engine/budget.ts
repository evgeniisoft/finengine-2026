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
   * Создание бюджета на 12 месяцев (скользящее планирование)
   * @param companyId - ID компании
   * @param startMonth - Начальный месяц (YYYY-MM)
   * @param accounts - Счета/статьи
   * @param historicalTransactions - Исторические операции (для калибровки)
   * @returns Бюджет на 12 месяцев
   */
  createRollingBudget(
    companyId: string,
    startMonth: string,
    accounts: Account[],
    historicalTransactions: Transaction[]
  ): Budget[] {
    
    const budgets: Budget[] = [];
    
    // Получаем 12 месяцев начиная с startMonth
    const months = this.getNextMonths(startMonth, 12);
    
    // Для каждого месяца и каждой статьи создаём бюджет
    for (const month of months) {
      for (const account of accounts) {
        // Только для доходов и расходов
        if (account.type === 'I' || account.type === 'X') {
          
          // Базовая сумма из исторических данных
          const baseAmount = this.calculateBaseAmount(
            account.id,
            month,
            historicalTransactions
          );
          
          budgets.push({
            id: this.generateId(),
            company_id: companyId,
            period: month,
            account_id: account.id,
            planned_amount: baseAmount,
            actual_amount: 0
          });
        }
      }
    }
    
    return budgets;
  }
  
  /**
   * Расчёт базовой суммы для бюджета на основе историчности
   */
  private calculateBaseAmount(
    accountId: string,
    month: string,
    transactions: Transaction[]
  ): number {
    
    // Фильтруем операции по счёту и прошлым периодам
    const historical = transactions.filter(t => {
      const tMonth = t.date.substring(0, 7); // YYYY-MM
      return tMonth < month && 
        (t.debit_account_id === accountId || t.credit_account_id === accountId);
    });
    
    if (historical.length === 0) return 0;
    
    // Среднее значение за последние 3 месяца
    const last3Months = this.getLastMonths(month, 3);
    const recent = historical.filter(t => {
      const tMonth = t.date.substring(0, 7);
      return last3Months.includes(tMonth);
    });
    
    const base = recent.length > 0 ? recent : historical;
    const total = base.reduce((sum, t) => sum + t.amount_rub, 0);
    
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
      // Фильтруем операции по периоду и счёту
      const actualTransactions = transactions.filter(t => {
        const tMonth = t.date.substring(0, 7);
        return tMonth === budget.period &&
          (t.debit_account_id === budget.account_id || 
           t.credit_account_id === budget.account_id);
      });
      
      // Суммируем фактические расходы/доходы
      let actualAmount = 0;
      for (const t of actualTransactions) {
        const account = accounts.find(a => a.id === budget.account_id);
        if (!account) continue;
        
        if (account.type === 'I') {
          // Доходы (кредит)
          if (t.credit_account_id === budget.account_id) {
            actualAmount += t.amount_rub;
          }
        } else if (account.type === 'X') {
          // Расходы (дебет)
          if (t.debit_account_id === budget.account_id) {
            actualAmount += t.amount_rub;
          }
        }
      }
      
      return {
        ...budget,
        actual_amount: actualAmount
      };
    });
  }
  
  /**
   * Калибровка бюджета на основе отклонений
   * Если факт отклоняется от плана, корректируем будущие периоды
   */
  calibrateBudget(
    budgets: Budget[],
    currentMonth: string
  ): Budget[] {
    
    return budgets.map(budget => {
      const budgetMonth = budget.period;
      
      // Калибруем только будущие периоды
      if (budgetMonth > currentMonth) {
        // Находим отклонение за последний закрытый месяц
        const lastClosedMonth = this.getPreviousMonth(currentMonth);
        const lastBudget = budgets.find(b => 
          b.period === lastClosedMonth && 
          b.account_id === budget.account_id
        );
        
        if (lastBudget && lastBudget.planned_amount > 0) {
          const deviation = lastBudget.actual_amount / lastBudget.planned_amount;
          
          // Применяем коэффициент отклонения к будущему бюджету
          const calibratedAmount = budget.planned_amount * deviation;
          
          return {
            ...budget,
            planned_amount: Math.round(calibratedAmount * 100) / 100
          };
        }
      }
      
      return budget;
    });
  }
  
  /**
   * Получение следующих N месяцев
   */
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
  
  /**
   * Получение предыдущих N месяцев
   */
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
  
  /**
   * Получение предыдущего месяца
   */
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