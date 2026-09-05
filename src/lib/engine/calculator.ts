/**
 * ============================================
 * FinEngine 2026 - Калькулятор отчётов
 * ============================================
 * Рассчитывает ДДС, ОПиУ, Баланс на основе операций.
 */

import {
  Transaction,
  Account,
  CashFlowReport,
  PnLReport,
  BalanceSheet,
  JournalEntry
} from './types';
import { taxEngine } from './tax';

export class FinancialCalculator {

  /**
   * Создание проводок из операции (двойная запись)
   */
  createJournalEntries(transaction: Transaction): JournalEntry[] {
    const entries: JournalEntry[] = [];

    entries.push({
      id: this.generateId(),
      transaction_id: transaction.id,
      date: transaction.date,
      company_id: transaction.company_id,
      account_id: transaction.debit_account_id,
      debit: transaction.amount,
      credit: 0,
      currency: transaction.currency,
      amount_rub: transaction.amount_rub
    });

    entries.push({
      id: this.generateId(),
      transaction_id: transaction.id,
      date: transaction.date,
      company_id: transaction.company_id,
      account_id: transaction.credit_account_id,
      debit: 0,
      credit: transaction.amount,
      currency: transaction.currency,
      amount_rub: transaction.amount_rub
    });

    return entries;
  }

  /**
   * Расчёт EBITDA
   * EBITDA = Чистая прибыль + Налог на прибыль + Амортизация
   */
  calculateEBITDA(pnl: PnLReport, taxCalc: any): number {
    const netProfit = pnl.net_profit || 0;
    const incomeTax = taxCalc?.income_tax_amount || 0;
    const depreciation = pnl.depreciation || 0;
    return netProfit + incomeTax + depreciation;
  }

  /**
   * Расчёт ДДС (Cash Flow)
   */
  calculateCashFlow(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    periodStart: string,
    periodEnd: string
  ): CashFlowReport {

    const filtered = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === companyId &&
        txDate >= periodStart &&
        txDate <= periodEnd;
    });

    const beforePeriod = transactions.filter(t =>
      t.company_id === companyId && t.date < periodStart
    );

    const startingBalance = this.calculateBalance(beforePeriod, accounts);

    let operatingInflow = 0;
    let operatingOutflow = 0;
    let investingInflow = 0;
    let investingOutflow = 0;
    let financingInflow = 0;
    let financingOutflow = 0;

    for (const t of filtered) {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAccount || !creditAccount) continue;

      if (t.debit_account_id === 'acc-bank-001') {
        if (creditAccount.type === 'I') {
          operatingInflow += t.amount_rub;
        } else if (creditAccount.type === 'A') {
          investingInflow += t.amount_rub;
        } else if (creditAccount.type === 'L') {
          financingInflow += t.amount_rub;
        }
      } else if (t.credit_account_id === 'acc-bank-001') {
        if (debitAccount.type === 'X') {
          operatingOutflow += t.amount_rub;
        } else if (debitAccount.type === 'A') {
          investingOutflow += t.amount_rub;
        } else if (debitAccount.type === 'L') {
          financingOutflow += t.amount_rub;
        }
      }
    }

    const endingBalance = startingBalance +
      operatingInflow - operatingOutflow +
      investingInflow - investingOutflow +
      financingInflow - financingOutflow;

    return {
      period_start: periodStart,
      period_end: periodEnd,
      company_id: companyId,
      starting_balance: startingBalance,
      operating_inflow: operatingInflow,
      operating_outflow: operatingOutflow,
      investing_inflow: investingInflow,
      investing_outflow: investingOutflow,
      financing_inflow: financingInflow,
      financing_outflow: financingOutflow,
      ending_balance: endingBalance,
    };
  }

  /**
   * Расчёт ОПиУ (P&L)
   */
  calculatePnL(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    periodStart: string,
    periodEnd: string,
    company?: any
  ): PnLReport {

    const filtered = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === companyId &&
        txDate >= periodStart &&
        txDate <= periodEnd;
    });

    let costOfGoodsSold = 0;
    let operatingExpenses = 0;
    let depreciation = 0;
    let taxes = 0;

    // Получаем расчёт налогов (для корректной выручки без НДС)
    const taxCalc = taxEngine.calculateTax(company, transactions, accounts, periodStart, periodEnd);

    // Выручка без НДС из налогового расчёта
    const revenue = taxCalc.revenue_without_vat;

    // Классифицируем расходы
    for (const t of filtered) {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAccount || !creditAccount) continue;

      if (debitAccount.type === 'X') {
        const category = debitAccount.code;

        if (category === 'COGS') {
          costOfGoodsSold += t.amount_rub;
        } else if (category === 'DEPRECIATION') {
          depreciation += t.amount_rub;
        } else if (category === 'TAXES') {
          taxes += t.amount_rub;
        } else {
          operatingExpenses += t.amount_rub;
        }
      }
    }

    // Налоги из taxEngine (без НДС)
    const taxesAmount = taxCalc.total_tax;
    taxes = taxesAmount;

    const grossProfit = revenue - costOfGoodsSold;
    const netProfit = grossProfit - operatingExpenses - depreciation - taxesAmount;

    return {
      period_start: periodStart,
      period_end: periodEnd,
      company_id: companyId,
      revenue,
      cost_of_goods_sold: costOfGoodsSold,
      gross_profit: grossProfit,
      operating_expenses: operatingExpenses,
      depreciation,
      taxes,
      net_profit: netProfit
    };
  }

  /**
   * Расчёт Баланса
   */
  calculateBalanceSheet(
    transactions: Transaction[],
    accounts: Account[],
    companyId: string,
    date: string
  ): BalanceSheet {

    const filtered = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === companyId && txDate <= date;
    });

    let cash = 0;
    let accountsReceivable = 0;
    let inventory = 0;
    let fixedAssets = 0;
    let accountsPayable = 0;
    let loans = 0;
    let capital = 0;

    for (const t of filtered) {
      if (t.credit_account_id === 'acc-equity-001' && t.record_type === 'fact') {
        capital += t.amount_rub;
        cash += t.amount_rub;
      }
    }

    for (const t of filtered) {
      if (t.credit_account_id === 'acc-equity-001' && t.record_type === 'fact') {
        continue;
      }

      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAccount || !creditAccount) continue;

      const debitIsCash = Boolean(debitAccount.is_cash_flow);
      const creditIsCash = Boolean(creditAccount.is_cash_flow);

      if (debitIsCash) cash += t.amount_rub;
      if (creditIsCash) cash -= t.amount_rub;

      if (debitAccount.code === 'AR') accountsReceivable += t.amount_rub;
      if (creditAccount.code === 'AR') accountsReceivable -= t.amount_rub;

      if (debitAccount.code === 'INVENTORY') inventory += t.amount_rub;
      if (creditAccount.code === 'INVENTORY') inventory -= t.amount_rub;

      if (debitAccount.code === 'FIXED_ASSETS') fixedAssets += t.amount_rub;
      if (creditAccount.code === 'FIXED_ASSETS') fixedAssets -= t.amount_rub;

      if (creditAccount.code === 'AP') accountsPayable += t.amount_rub;
      if (debitAccount.code === 'AP') accountsPayable -= t.amount_rub;

      if (creditAccount.code === 'LOANS') loans += t.amount_rub;
      if (debitAccount.code === 'LOANS') loans -= t.amount_rub;
    }

    const totalAssets = cash + accountsReceivable + inventory + fixedAssets;
    const totalLiabilities = accountsPayable + loans;
    const totalEquity = totalAssets - totalLiabilities;

    return {
      date,
      company_id: companyId,
      assets: {
        cash,
        accounts_receivable: accountsReceivable,
        inventory,
        fixed_assets: fixedAssets,
        total: totalAssets
      },
      liabilities: {
        accounts_payable: accountsPayable,
        loans,
        total: totalLiabilities
      },
      equity: {
        capital,
        retained_earnings: totalEquity,
        total: totalEquity
      }
    };
  }

  /**
   * Вспомогательные функции
   */
  private calculateBalance(transactions: Transaction[], accounts: Account[]): number {
    let balance = 0;

    for (const t of transactions) {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAccount || !creditAccount) continue;

      const debitIsCash = Boolean(debitAccount.is_cash_flow);
      const creditIsCash = Boolean(creditAccount.is_cash_flow);

      if (debitIsCash) balance += t.amount_rub;
      if (creditIsCash) balance -= t.amount_rub;
    }

    return balance;
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Экспорт singleton
export const calculator = new FinancialCalculator();