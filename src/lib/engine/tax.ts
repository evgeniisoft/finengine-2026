/**
 * ============================================
 * FinEngine 2026 - Налоговый движок
 * ============================================
 * Расчёт налогов для разных систем налогообложения.
 * УСН 6%, УСН 15%, ОСНО (налог на прибыль 25%, НДС 20%).
 */

import { Company, Transaction, Account } from './types';

export class TaxEngine {
  
  /**
   * Расчёт налога для компании за период
   */
  calculateTax(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ): {
    tax_type: string;
    tax_amount: number;
    tax_base: number;
    details: string;
  } {
    
    switch (company.tax_system) {
      case 'USN_6':
        return this.calculateUSN6(company, transactions, accounts, periodStart, periodEnd);
      case 'USN_15':
        return this.calculateUSN15(company, transactions, accounts, periodStart, periodEnd);
      case 'OSNO':
        return this.calculateOSNO(company, transactions, accounts, periodStart, periodEnd);
      default:
        return { tax_type: 'UNKNOWN', tax_amount: 0, tax_base: 0, details: '' };
    }
  }
  
  /**
   * УСН 6% (Доходы)
   */
  private calculateUSN6(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ) {
    
    // Налоговая база — все доходы
    const revenue = this.calculateRevenue(transactions, accounts, periodStart, periodEnd);
    const taxRate = 0.06;
    const taxAmount = revenue * taxRate;
    
    return {
      tax_type: 'УСН 6%',
      tax_amount: Math.round(taxAmount * 100) / 100,
      tax_base: revenue,
      details: `${revenue} × 6% = ${taxAmount}`
    };
  }
  
  /**
   * УСН 15% (Доходы минус Расходы)
   */
  private calculateUSN15(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ) {
    
    const revenue = this.calculateRevenue(transactions, accounts, periodStart, periodEnd);
    const expenses = this.calculateExpenses(transactions, accounts, periodStart, periodEnd);
    const taxBase = Math.max(0, revenue - expenses);
    
    // Минимальный налог 1% от доходов
    const minimumTax = revenue * 0.01;
    const regularTax = taxBase * 0.15;
    const taxAmount = Math.max(regularTax, minimumTax);
    
    return {
      tax_type: 'УСН 15%',
      tax_amount: Math.round(taxAmount * 100) / 100,
      tax_base: taxBase,
      details: `(${revenue} - ${expenses}) × 15% = ${taxAmount}`
    };
  }
  
  /**
   * ОСНО (налог на прибыль 25% + НДС 20%)
   */
  private calculateOSNO(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ) {
    
    const revenue = this.calculateRevenue(transactions, accounts, periodStart, periodEnd);
    const expenses = this.calculateExpenses(transactions, accounts, periodStart, periodEnd);
    
    // Налог на прибыль
    const profitTaxBase = Math.max(0, revenue - expenses);
    const profitTax = profitTaxBase * 0.25;
    
    // НДС (упрощённо)
    const vat = revenue * 0.20;
    
    const totalTax = profitTax + vat;
    
    return {
      tax_type: 'ОСНО',
      tax_amount: Math.round(totalTax * 100) / 100,
      tax_base: profitTaxBase,
      details: `Прибыль: ${profitTaxBase} × 25% = ${profitTax}, НДС: ${vat}`
    };
  }
  
  /**
   * Расчёт доходов за период
   */
  private calculateRevenue(
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ): number {
    
    return transactions
      .filter(t => {
        if (t.date < periodStart || t.date > periodEnd) return false;
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);
        return creditAccount && creditAccount.type === 'I';
      })
      .reduce((sum, t) => sum + t.amount_rub, 0);
  }
  
  /**
   * Расчёт расходов за период
   */
  private calculateExpenses(
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ): number {
    
    return transactions
      .filter(t => {
        if (t.date < periodStart || t.date > periodEnd) return false;
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        return debitAccount && debitAccount.type === 'X';
      })
      .reduce((sum, t) => sum + t.amount_rub, 0);
  }
  
  /**
   * Проверка лимитов УСН
   */
  checkUSNLimits(
    company: Company,
    transactions: Transaction[],
    accounts: Account[]
  ): {
    exceeded: boolean;
    current_revenue: number;
    limit: number;
    percentage: number;
  } {
    
    const limit = 450000000; // 450 млн руб.
    const currentYear = new Date().getFullYear().toString();
    
    const yearTransactions = transactions.filter(t => 
      t.date.startsWith(currentYear)
    );
    
    const revenue = this.calculateRevenue(
      yearTransactions,
      accounts,
      `${currentYear}-01-01`,
      `${currentYear}-12-31`
    );
    
    const percentage = (revenue / limit) * 100;
    
    return {
      exceeded: revenue > limit,
      current_revenue: revenue,
      limit: limit,
      percentage: Math.round(percentage * 100) / 100
    };
  }
  
  /**
   * Проверка порогов НДС для УСН
   */
  checkVATThreshold(
    company: Company,
    transactions: Transaction[],
    accounts: Account[]
  ): {
    vat_required: boolean;
    vat_rate: number;
    current_revenue: number;
    threshold: number;
  } {
    
    const currentYear = new Date().getFullYear().toString();
    
    const yearTransactions = transactions.filter(t => 
      t.date.startsWith(currentYear)
    );
    
    const revenue = this.calculateRevenue(
      yearTransactions,
      accounts,
      `${currentYear}-01-01`,
      `${currentYear}-12-31`
    );
    
    // Пороги НДС для УСН (2025+)
    const threshold1 = 60000000; // 60 млн
    const threshold2 = 250000000; // 250 млн
    const threshold3 = 450000000; // 450 млн
    
    let vatRequired = false;
    let vatRate = 0;
    
    if (revenue > threshold1 && revenue <= threshold2) {
      vatRequired = true;
      vatRate = 5;
    } else if (revenue > threshold2 && revenue <= threshold3) {
      vatRequired = true;
      vatRate = 7;
    } else if (revenue > threshold3) {
      vatRequired = true;
      vatRate = 20;
    }
    
    return {
      vat_required: vatRequired,
      vat_rate: vatRate,
      current_revenue: revenue,
      threshold: threshold1
    };
  }
}

export const taxEngine = new TaxEngine();