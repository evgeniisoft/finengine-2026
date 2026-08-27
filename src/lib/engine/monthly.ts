/**
 * ============================================
 * FinEngine 2026 - Детализация по месяцам
 * ============================================
 * Разбивка отчётов по месяцам для анализа динамики.
 */

import { Transaction, Account } from './types';

export interface MonthlyReport {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cash_in: number;
  cash_out: number;
  net_cash_flow: number;
  ending_balance: number;
}

export class MonthlyEngine {
  
  /**
   * Разбивка операций по месяцам
   */
  getMonthlyBreakdown(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    periodStart: string,
    periodEnd: string
  ): MonthlyReport[] {
    
    // Фильтруем по компании и периоду
    const filtered = transactions.filter(t =>
      t.company_id === companyId &&
      t.date >= periodStart &&
      t.date <= periodEnd
    );
    
    // Группируем по месяцам
    const monthsMap = new Map<string, Transaction[]>();
    
    for (const t of filtered) {
      const month = t.date.substring(0, 7); // YYYY-MM
      if (!monthsMap.has(month)) {
        monthsMap.set(month, []);
      }
      monthsMap.get(month)!.push(t);
    }
    
    // Сортируем месяцы
    const sortedMonths = Array.from(monthsMap.keys()).sort();
    
    // Рассчитываем показатели для каждого месяца
    let runningBalance = 0;
    const reports: MonthlyReport[] = [];
    
    for (const month of sortedMonths) {
      const monthTransactions = monthsMap.get(month)!;
      
      let revenue = 0;
      let expenses = 0;
      let cashIn = 0;
      let cashOut = 0;
      
      for (const t of monthTransactions) {
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);
        
        if (!debitAccount || !creditAccount) continue;
        
        // Доходы (ОПиУ)
        if (creditAccount.type === 'I') {
          revenue += t.amount_rub;
        }
        
        // Расходы (ОПиУ)
        if (debitAccount.type === 'X') {
          expenses += t.amount_rub;
        }
        
        // Поступления (ДДС)
        if (debitAccount.code === 'BANK_MAIN') {
          cashIn += t.amount_rub;
        }
        
        // Выбытия (ДДС)
        if (creditAccount.code === 'BANK_MAIN') {
          cashOut += t.amount_rub;
        }
      }
      
      runningBalance += cashIn - cashOut;
      
      reports.push({
        month,
        revenue,
        expenses,
        profit: revenue - expenses,
        cash_in: cashIn,
        cash_out: cashOut,
        net_cash_flow: cashIn - cashOut,
        ending_balance: runningBalance
      });
    }
    
    return reports;
  }
  
  /**
   * Получение списка месяцев в периоде
   */
  getMonthsInPeriod(periodStart: string, periodEnd: string): string[] {
    const months: string[] = [];
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
      
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    
    return months;
  }
}

export const monthlyEngine = new MonthlyEngine();