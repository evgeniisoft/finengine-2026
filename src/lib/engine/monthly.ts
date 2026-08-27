import { Transaction, Account } from './types';

export type PeriodType = 'monthly' | 'weekly' | 'daily';

export interface PeriodReport {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  cash_in: number;
  cash_out: number;
  net_cash_flow: number;
  ending_balance: number;
  // Детализация по статьям
  details: {
    [accountId: string]: number;
  };
}

export class MonthlyEngine {
  
  /**
   * Разбивка по периодам (месяцы, недели, дни)
   */
  getPeriodBreakdown(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    periodStart: string,
    periodEnd: string,
    periodType: PeriodType = 'monthly'
  ): PeriodReport[] {
    
    const filtered = transactions.filter(t =>
      t.company_id === companyId &&
      t.date >= periodStart &&
      t.date <= periodEnd
    );
    
    // Группируем по периодам
    const periodsMap = new Map<string, Transaction[]>();
    
    for (const t of filtered) {
      const periodKey = this.getPeriodKey(t.date, periodType);
      if (!periodsMap.has(periodKey)) {
        periodsMap.set(periodKey, []);
      }
      periodsMap.get(periodKey)!.push(t);
    }
    
    const sortedPeriods = Array.from(periodsMap.keys()).sort();
    let runningBalance = 0;
    const reports: PeriodReport[] = [];
    
    for (const period of sortedPeriods) {
      const periodTransactions = periodsMap.get(period)!;
      let revenue = 0;
      let expenses = 0;
      let cashIn = 0;
      let cashOut = 0;
      const details: { [accountId: string]: number } = {};
      
      for (const t of periodTransactions) {
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);
        
        if (!debitAccount || !creditAccount) continue;
        
        // ОПиУ: Доходы
        if (creditAccount.type === 'I') {
          revenue += t.amount_rub;
          details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
        }
        
        // ОПиУ: Расходы
        if (debitAccount.type === 'X') {
          expenses += t.amount_rub;
          details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
        }
        
        // ДДС: Поступления
        if (debitAccount.is_cash_flow && creditAccount.type !== 'X') {
          cashIn += t.amount_rub;
          details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
        }
        
        // ДДС: Выбытия
        if (creditAccount.is_cash_flow && debitAccount.type !== 'I') {
          cashOut += t.amount_rub;
          details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
        }
      }
      
      runningBalance += cashIn - cashOut;
      
      reports.push({
        period,
        revenue,
        expenses,
        profit: revenue - expenses,
        cash_in: cashIn,
        cash_out: cashOut,
        net_cash_flow: cashIn - cashOut,
        ending_balance: runningBalance,
        details
      });
    }
    
    return reports;
  }
  
  /**
   * Получение ключа периода
   */
  private getPeriodKey(date: string, periodType: PeriodType): string {
    const [year, month, day] = date.split('-');
    
    switch (periodType) {
      case 'monthly':
        return `${year}-${month}`;
      case 'weekly':
        // ISO неделя
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const weekNumber = this.getWeekNumber(d);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
      case 'daily':
        return date;
      default:
        return `${year}-${month}`;
    }
  }
  
  /**
   * Получение номера недели
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
  
  /**
   * Прогноз кассовых разрывов (платёжный календарь)
   */
  forecastCashFlow(
    companyId: string,
    currentBalance: number,
    startDate: string,
    days: number,
    plannedInflows: { date: string; amount: number; account: string }[],
    plannedOutflows: { date: string; amount: number; account: string }[]
  ): { date: string; balance: number; is_deficit: boolean }[] {
    
    const forecasts = [];
    let balance = currentBalance;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const inflow = plannedInflows
        .filter(item => item.date === dateStr)
        .reduce((sum, item) => sum + item.amount, 0);
      
      const outflow = plannedOutflows
        .filter(item => item.date === dateStr)
        .reduce((sum, item) => sum + item.amount, 0);
      
      balance += inflow - outflow;
      
      forecasts.push({
        date: dateStr,
        balance,
        is_deficit: balance < 0
      });
    }
    
    return forecasts;
  }
}

export const monthlyEngine = new MonthlyEngine();