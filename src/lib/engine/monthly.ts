import { Transaction, Account, Company } from './types';
import { taxEngine } from './tax';

export type PeriodType = 'monthly' | 'weekly' | 'daily';

export interface PeriodReport {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  cash_in: number;
  cash_out: number;
  tax_outflow: number;
  net_cash_flow: number;
  starting_balance: number;
  ending_balance: number;
  details: {
    [accountId: string]: number;
  };
}

export class MonthlyEngine {

  /**
   * Разбивка по периодам (месяцы, недели, дни)
   * С полным расчётом налогов
   */
  getPeriodBreakdown(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    periodStart: string,
    periodEnd: string,
    periodType: PeriodType = 'monthly',
    company?: Company,
    reportType: 'pnl' | 'cashflow' | 'balance' = 'pnl'
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

    // Начальный остаток — операции до periodStart
    const beforePeriod = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === companyId && txDate < periodStart;
    });

    let runningBalance = 0;
    for (const t of beforePeriod) {
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);
      if (!debitAcc || !creditAcc) continue;
      const debitIsCash = Boolean(debitAcc.is_cash_flow);
      const creditIsCash = Boolean(creditAcc.is_cash_flow);
      if (debitIsCash) runningBalance += t.amount_rub;
      if (creditIsCash) runningBalance -= t.amount_rub;
    }

    // Для cashflow — вычитаем налоги за все месяцы до ПЕРВОГО периода отчёта
    if (reportType === 'cashflow' && company && sortedPeriods.length > 0) {
      const firstPeriod = sortedPeriods[0];
      const firstPeriodStart = this.getPeriodStartDate(firstPeriod, periodType);
      const firstPeriodMonth = firstPeriodStart.substring(0, 7);

      const monthsBeforeReport: string[] = [];
      for (const t of transactions) {
        if (t.company_id !== companyId) continue;
        const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
        const monthKey = txDate.substring(0, 7);
        if (monthKey < firstPeriodMonth && !monthsBeforeReport.includes(monthKey)) {
          monthsBeforeReport.push(monthKey);
        }
      }

      for (const monthKey of monthsBeforeReport) {
        const monthStart = `${monthKey}-01`;
        const [y, m] = monthKey.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

        const taxCalcBefore = taxEngine.calculateTax(
          company,
          transactions,
          accounts,
          monthStart,
          monthEnd
        );

        const monthNum = m;
        const isQuarterEndBefore = monthNum === 3 || monthNum === 6 || monthNum === 9 || monthNum === 12;
        const hasEmployeesBefore = String(company?.has_employees).toLowerCase() === 'true' || (company?.monthly_payroll || 0) > 0;

        const vatPayment = isQuarterEndBefore ? taxCalcBefore.vat_to_pay : 0;
        const incomeTaxPayment = isQuarterEndBefore ? taxCalcBefore.income_tax_amount : 0;
        const insurancePayment = hasEmployeesBefore ? taxCalcBefore.insurance_amount : 0;
        const ndflPayment = hasEmployeesBefore ? taxCalcBefore.ndfl_amount : 0;

        runningBalance -= (insurancePayment + ndflPayment + vatPayment + incomeTaxPayment);
      }
    }

    // Для balance: считаем начальные остатки по каждому счёту
    let balanceDetails: { [accountId: string]: number } = {};
    if (reportType === 'balance') {
      balanceDetails = this.calculateBalanceDetails(beforePeriod, accounts);
    }

    const reports: PeriodReport[] = [];

    for (const period of sortedPeriods) {
      const periodTransactions = periodsMap.get(period)!;

      // Определяем начало и конец периода
      const periodStartDate = this.getPeriodStartDate(period, periodType);
      const periodEndDate = this.getPeriodEndDate(period, periodType);

      let revenue = 0;
      let expenses = 0;
      let cashIn = 0;
      let cashOut = 0;
      const details: { [accountId: string]: number } = {};

      // Расчёт налогов для этого периода
      let taxCalc: any = null;
      if (company) {
        taxCalc = taxEngine.calculateTax(
          company,
          transactions,
          accounts,
          periodStartDate,
          periodEndDate
        );
      }

      // ============ БАЛАНС ============
      if (reportType === 'balance') {
        // Копируем начальные остатки
        for (const [accId, amount] of Object.entries(balanceDetails)) {
          details[accId] = amount;
        }

        // Применяем операции периода
        for (const t of periodTransactions) {
          const debitAccount = accounts.find(a => a.id === t.debit_account_id);
          const creditAccount = accounts.find(a => a.id === t.credit_account_id);

          if (!debitAccount || !creditAccount) continue;

          const debitIsCash = Boolean(debitAccount.is_cash_flow);
          const creditIsCash = Boolean(creditAccount.is_cash_flow);

          // Денежные счета
          if (debitIsCash) {
            details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
          }
          if (creditIsCash) {
            details[creditAccount.id] = (details[creditAccount.id] || 0) - t.amount_rub;
          }

          // Не денежные счета (Активы, Пассивы, Капитал)
          if (!debitIsCash && debitAccount.type === 'A') {
            details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
          }
          if (!creditIsCash && creditAccount.type === 'A') {
            details[creditAccount.id] = (details[creditAccount.id] || 0) - t.amount_rub;
          }

          if (!creditIsCash && creditAccount.type === 'L') {
            details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
          }
          if (!debitIsCash && debitAccount.type === 'L') {
            details[debitAccount.id] = (details[debitAccount.id] || 0) - t.amount_rub;
          }

          if (!creditIsCash && creditAccount.type === 'E') {
            details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
          }
          if (!debitIsCash && debitAccount.type === 'E') {
            details[debitAccount.id] = (details[debitAccount.id] || 0) - t.amount_rub;
          }
        }

        // Обновляем balanceDetails для следующего периода
        balanceDetails = { ...details };

        // Для баланса: revenue/expenses/profit не нужны
        const totalAssets = this.calculateTotalAssets(details, accounts);
        let totalLiabilities = this.calculateTotalLiabilities(details, accounts);

        // Добавляем задолженность по налогам как обязательство
        if (taxCalc) {
          const taxLiability = taxCalc.income_tax_amount + taxCalc.insurance_amount + taxCalc.ndfl_amount + taxCalc.vat_to_pay;
          totalLiabilities += taxLiability;
          details['acc-tax-liability'] = taxLiability;
        }

        const totalEquity = totalAssets - totalLiabilities;

        reports.push({
          period,
          revenue: 0,
          expenses: 0,
          profit: totalAssets - totalLiabilities,
          cash_in: 0,
          cash_out: 0,
          tax_outflow: 0,
          net_cash_flow: 0,
          starting_balance: 0,
          ending_balance: totalAssets,
          details
        });
        continue;
      }

      // ============ P&L И CASH FLOW ============
      for (const t of periodTransactions) {
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);

        if (!debitAccount || !creditAccount) continue;
        const debitIsCash = Boolean(debitAccount.is_cash_flow);
        const creditIsCash = Boolean(creditAccount.is_cash_flow);

        // Выручка
        if (creditAccount.type === 'I' && creditAccount.activity_type === 'operating' &&
          !creditAccount.id.startsWith('acc-in-invest-') && creditAccount.id !== 'acc-in-loan') {
          revenue += t.amount_rub;
          details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
        }

        // Расходы — только для P&L
        if (reportType === 'pnl' && debitAccount.type === 'X' && debitAccount.activity_type === 'operating' &&
          !debitAccount.id.startsWith('acc-tax-') &&
          !debitAccount.id.startsWith('acc-depreciation-') &&
          debitAccount.id !== 'acc-out-capex' &&
          !debitAccount.id.startsWith('acc-out-loan-') &&
          debitAccount.id !== 'acc-out-dividends') {
          let expenseAmount = t.amount_rub;
          const vatIncluded = String(company?.vat_included).toLowerCase() === 'true';
          const vatRate = parseFloat(String(company?.vat_rate || '0'));
          if (vatIncluded && vatRate > 0) {
            expenseAmount = expenseAmount / (1 + vatRate);
          }
          expenses += expenseAmount;
          details[debitAccount.id] = (details[debitAccount.id] || 0) + expenseAmount;
        }

        // ДДС: Поступления (деньги пришли на денежный счёт)
        if (debitIsCash && !creditIsCash) {
          cashIn += t.amount_rub;
          details[`in_${debitAccount.id}`] = (details[`in_${debitAccount.id}`] || 0) + t.amount_rub;
        }

        // ДДС: Выбытия (деньги ушли с денежного счёта)
        if (creditIsCash && !debitIsCash) {
          let cashOutflowAmount = t.amount_rub;
          const vatIncluded = String(company?.vat_included).toLowerCase() === 'true';
          const vatRate = parseFloat(String(company?.vat_rate || '0'));
          if (vatIncluded && vatRate > 0) {
            cashOutflowAmount = cashOutflowAmount / (1 + vatRate);
          }
          cashOut += cashOutflowAmount;

          // Для cashflow — записываем фактически оплаченное в details
          if (reportType === 'cashflow' && debitAccount.type === 'X' && debitAccount.activity_type === 'operating') {
            details[debitAccount.id] = (details[debitAccount.id] || 0) + cashOutflowAmount;
          }
        }
      }

      // Если есть taxCalc — используем его данные для выручки и расходов
      if (taxCalc && reportType === 'pnl') {
        revenue = taxCalc.revenue_without_vat;
        expenses = taxCalc.expenses_without_vat;
      }

      // Флаги для налогов
      const hasEmployees = Boolean(company?.has_employees) || (company?.monthly_payroll || 0) > 0;
      const monthNum = parseInt(period.substring(5, 7));
      const isQuarterEnd = monthNum === 3 || monthNum === 6 || monthNum === 9 || monthNum === 12;

      // Записываем налоги в details ДЕТАЛИЗИРОВАННО
      if (taxCalc) {
        if (reportType === 'pnl' || reportType === 'cashflow') {
          // Ежемесячные налоги
          details['acc-tax-insurance'] = taxCalc.insurance_amount;
          details['acc-tax-ndfl'] = taxCalc.ndfl_amount;

          if (isQuarterEnd) {
            details['acc-tax-vat'] = taxCalc.vat_to_pay;

            if (company?.tax_system === 'USN_6' || company?.tax_system === 'USN_15') {
              details['acc-tax-usn'] = taxCalc.income_tax_amount;
              details['acc-tax-profit'] = 0;
            } else if (company?.tax_system === 'OSNO') {
              details['acc-tax-usn'] = 0;
              details['acc-tax-profit'] = taxCalc.income_tax_amount;
            }
          } else {
            details['acc-tax-vat'] = 0;
            details['acc-tax-usn'] = 0;
            details['acc-tax-profit'] = 0;
          }
        }

        // Для cashflow — детализация налоговых выбытий (только реально уплачиваемое за период)
        if (reportType === 'cashflow') {
          details['tax_insurance'] = hasEmployees ? taxCalc.insurance_amount : 0;
          details['tax_ndfl'] = hasEmployees ? taxCalc.ndfl_amount : 0;
          details['tax_vat'] = isQuarterEnd ? taxCalc.vat_to_pay : 0;
          details['tax_income'] = isQuarterEnd ? taxCalc.income_tax_amount : 0;
        }
      }

      // Налоговые выбытия за период — только то, что реально уплачивается деньгами
      let taxOutflow = 0;
      if (taxCalc) {
        const vatPayment = isQuarterEnd ? taxCalc.vat_to_pay : 0;
        const incomeTaxPayment = isQuarterEnd ? taxCalc.income_tax_amount : 0;
        const insurancePayment = hasEmployees ? taxCalc.insurance_amount : 0;
        const ndflPayment = hasEmployees ? taxCalc.ndfl_amount : 0;

        taxOutflow = insurancePayment + ndflPayment + vatPayment + incomeTaxPayment;
      }

      // Прибыль с учётом налогов
      let profit = revenue - expenses;
      if (taxCalc && reportType === 'pnl') {
        profit = taxCalc.profit_before_tax - taxCalc.income_tax_amount - taxCalc.insurance_amount - taxCalc.ndfl_amount;
      }

      const startingBalanceForPeriod = runningBalance;
      if (reportType === 'cashflow') {
        runningBalance += cashIn - cashOut - taxOutflow;
      } else {
        runningBalance += cashIn - cashOut;
      }

      reports.push({
        period,
        revenue: reportType === 'pnl' ? revenue : 0,
        expenses: reportType === 'pnl' ? expenses : 0,
        profit: reportType === 'pnl' ? profit : 0,
        cash_in: cashIn,
        cash_out: cashOut,
        tax_outflow: taxOutflow,
        net_cash_flow: cashIn - cashOut,
        starting_balance: startingBalanceForPeriod,
        ending_balance: runningBalance,
        details
      });
    }

    return reports;
  }

  /**
   * Получение даты начала периода
   */
  private getPeriodStartDate(period: string, periodType: PeriodType): string {
    switch (periodType) {
      case 'monthly':
        return `${period}-01`;
      case 'weekly': {
        const [year, week] = period.split('-W');
        const d = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
        return d.toISOString().split('T')[0];
      }
      case 'daily':
        return period;
      default:
        return `${period}-01`;
    }
  }

  /**
   * Получение даты конца периода
   */
  private getPeriodEndDate(period: string, periodType: PeriodType): string {
    switch (periodType) {
      case 'monthly': {
        const [year, month] = period.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return `${period}-${String(lastDay).padStart(2, '0')}`;
      }
      case 'weekly': {
        const [year, week] = period.split('-W');
        const d = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7 + 6);
        return d.toISOString().split('T')[0];
      }
      case 'daily':
        return period;
      default:
        return period;
    }
  }

  /**
   * Получение ключа периода
   */
  private getPeriodKey(date: string, periodType: PeriodType): string {
    const [year, month, day] = date.split('-');

    switch (periodType) {
      case 'monthly':
        return `${year}-${month}`;
      case 'weekly': {
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const weekNumber = this.getWeekNumber(d);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
      }
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
   * Прогноз кассовых разрывов
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

  /**
   * Расчёт остатков по счетам на начало периода (для баланса)
   */
  private calculateBalanceDetails(transactions: Transaction[], accounts: Account[]): { [accountId: string]: number } {
    const details: { [accountId: string]: number } = {};

    for (const t of transactions) {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAccount || !creditAccount) continue;

      const debitIsCash = Boolean(debitAccount.is_cash_flow);
      const creditIsCash = Boolean(creditAccount.is_cash_flow);

      // Денежные счета
      if (debitIsCash) {
        details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
      }
      if (creditIsCash) {
        details[creditAccount.id] = (details[creditAccount.id] || 0) - t.amount_rub;
      }

      // Не денежные счета
      if (!debitIsCash && debitAccount.type === 'A') {
        details[debitAccount.id] = (details[debitAccount.id] || 0) + t.amount_rub;
      }
      if (!creditIsCash && creditAccount.type === 'A') {
        details[creditAccount.id] = (details[creditAccount.id] || 0) - t.amount_rub;
      }

      if (!creditIsCash && creditAccount.type === 'L') {
        details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
      }
      if (!debitIsCash && debitAccount.type === 'L') {
        details[debitAccount.id] = (details[debitAccount.id] || 0) - t.amount_rub;
      }

      if (!creditIsCash && creditAccount.type === 'E') {
        details[creditAccount.id] = (details[creditAccount.id] || 0) + t.amount_rub;
      }
      if (!debitIsCash && debitAccount.type === 'E') {
        details[debitAccount.id] = (details[debitAccount.id] || 0) - t.amount_rub;
      }
    }

    return details;
  }

  /**
   * Расчёт итоговых активов
   */
  private calculateTotalAssets(details: { [accountId: string]: number }, accounts: Account[]): number {
    let total = 0;
    for (const account of accounts) {
      if (account.type === 'A' || account.is_cash_flow) {
        total += details[account.id] || 0;
      }
    }
    return total;
  }

  /**
   * Расчёт итоговых пассивов
   */
  private calculateTotalLiabilities(details: { [accountId: string]: number }, accounts: Account[]): number {
    let total = 0;
    for (const account of accounts) {
      if (account.type === 'L') {
        total += details[account.id] || 0;
      }
    }
    return total;
  }

  /**
   * Расчёт итогового капитала
   */
  private calculateTotalEquity(details: { [accountId: string]: number }, accounts: Account[]): number {
    let total = 0;
    for (const account of accounts) {
      if (account.type === 'E') {
        total += details[account.id] || 0;
      }
    }
    return total;
  }
}

export const monthlyEngine = new MonthlyEngine();