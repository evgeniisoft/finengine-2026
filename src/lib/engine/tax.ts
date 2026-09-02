/**
 * ============================================
 * FinEngine 2026 - Налоговый движок
 * ============================================
 * Актуальные ставки 2026 года:
 * - НДС ОСНО: 22% (базовая), 10% (льготная)
 * - НДС УСН: 0% (до 20 млн), 5% (20-250 млн), 7% (250-490.5 млн)
 * - Налог на прибыль ОСНО: 25%
 * - УСН 6%: Доходы × 6%
 * - УСН 15%: (Доходы - Расходы) × 15%
 */

import { Company, Transaction, Account } from './types';

export interface TaxCalculation {
  company_id: string;
  company_name: string;
  tax_system: string;
  revenue_without_vat: number;
  expenses_without_vat: number;
  profit_before_tax: number;
  vat_rate: number;
  vat_amount: number;
  income_tax_rate: number;
  income_tax_amount: number;
  insurance_rate: number;
  insurance_amount: number;
  total_tax: number;
  effective_tax_rate: number;
}

export class TaxEngine {

  /**
   * Расчёт налогов для компании за период
   */
  calculateTax(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ): TaxCalculation {

    // Фильтруем транзакции по периоду и компании
    const companyTx = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === company.id && txDate >= periodStart && txDate <= periodEnd;
    });

    // Доходы (без НДС)
    const revenue = companyTx
      .filter(t => {
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);
        return creditAccount?.type === 'I';
      })
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    // Расходы (без НДС)
    const expenses = companyTx
      .filter(t => {
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        return debitAccount?.type === 'X';
      })
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    const profit = revenue - expenses;

    // Определяем ставки
    let vatRate = 0;
    let incomeTaxRate = 0;
    let vatAmount = 0;
    let incomeTaxAmount = 0;

    switch (company.tax_system) {
      case 'USN_6':
        // НДС: проверяем порог
        vatRate = this.getVatRateForUSN(revenue);
        vatAmount = revenue * vatRate;

        // УСН 6% от доходов (доходы не включают НДС)
        incomeTaxRate = 0.06;
        incomeTaxAmount = revenue * incomeTaxRate;
        break;

      case 'USN_15':
        vatRate = this.getVatRateForUSN(revenue);
        vatAmount = revenue * vatRate;

        incomeTaxRate = 0.15;
        const taxBase = Math.max(0, revenue - expenses);
        incomeTaxAmount = taxBase * incomeTaxRate;

        // Минимальный налог 1% от доходов
        const minimumTax = revenue * 0.01;
        if (incomeTaxAmount < minimumTax) {
          incomeTaxAmount = minimumTax;
        }
        break;

      case 'OSNO':
        vatRate = 0.22;
        vatAmount = revenue * vatRate;

        incomeTaxRate = 0.25;
        incomeTaxAmount = Math.max(0, profit) * incomeTaxRate;
        break;

      default:
        break;
    }

    // Страховые взносы
    const insurance = this.calculateInsuranceContributions(company);
    const insuranceAmount = insurance.annual_contributions;

    // УСН 6% можно уменьшить на взносы (до 50%)
    let finalIncomeTax = incomeTaxAmount;
    if (company.tax_system === 'USN_6' && company.has_employees) {
      const maxReduction = incomeTaxAmount * 0.5;
      finalIncomeTax = Math.max(incomeTaxAmount - Math.min(insuranceAmount, maxReduction), 0);
    }

    const totalTax = vatAmount + finalIncomeTax + insuranceAmount;
    const effectiveRate = revenue > 0 ? (totalTax / revenue) * 100 : 0;

    return {
      company_id: company.id,
      company_name: company.name,
      tax_system: company.tax_system,
      revenue_without_vat: revenue,
      expenses_without_vat: expenses,
      profit_before_tax: profit,
      vat_rate: vatRate,
      vat_amount: Math.round(vatAmount * 100) / 100,
      income_tax_rate: incomeTaxRate,
      income_tax_amount: Math.round(finalIncomeTax * 100) / 100,
      insurance_rate: insurance.rate,
      insurance_amount: insuranceAmount,
      total_tax: Math.round(totalTax * 100) / 100,
      effective_tax_rate: Math.round((totalTax / revenue) * 10000) / 100
    };
  }

  /**
   * Определение ставки НДС для УСН по выручке
   */
  private getVatRateForUSN(revenue: number): number {
    if (revenue <= 20000000) {
      return 0; // Автоматическое освобождение
    } else if (revenue <= 250000000) {
      return 0.05; // 5%
    } else if (revenue <= 490500000) {
      return 0.07; // 7%
    } else {
      return 0.22; // 22% (превышение)
    }
  }

  /**
   * Проверка лимитов УСН
   */
  checkUSNLimits(company: Company, transactions: Transaction[]): {
    current_revenue: number;
    limit: number;
    percentage: number;
    vat_required: boolean;
    vat_rate: number;
  } {
    const currentYear = new Date().getFullYear().toString();
    const yearTx = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === company.id && txDate.startsWith(currentYear);
    });

    const revenue = yearTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    const limit = 490500000;
    const vatThreshold = 20000000;

    return {
      current_revenue: revenue,
      limit,
      percentage: Math.round((revenue / limit) * 100 * 100) / 100,
      vat_required: revenue > vatThreshold,
      vat_rate: this.getVatRateForUSN(revenue)
    };
  }
  /**
 * Расчёт страховых взносов
 */
  calculateInsuranceContributions(company: Company): {
    annual_contributions: number;
    monthly_contributions: number;
    rate: number;
  } {
    const payroll = company.monthly_payroll || 0;
    const annualPayroll = payroll * 12;

    let contributions = 0;
    let rate = 0;

    if (company.is_individual) {
      // Фиксированные взносы ИП
      contributions = 57390;
      rate = 0;
    } else if (company.industry_type === 'it') {
      // IT: 15% до лимита, 7.6% сверх
      const limit = 2979000;
      if (annualPayroll <= limit) {
        contributions = annualPayroll * 0.15;
        rate = 15;
      } else {
        contributions = limit * 0.15 + (annualPayroll - limit) * 0.076;
        rate = 7.6;
      }
    } else if (company.industry_type === 'msp_priority') {
      // МСП: 30% до 1.5 МРОТ, 15% сверх
      const mrot = 27093;
      const threshold = mrot * 1.5;
      const monthlyBase = Math.min(payroll, threshold);
      const excess = Math.max(0, payroll - threshold);
      const monthlyContributions = monthlyBase * 0.30 + excess * 0.15;
      contributions = monthlyContributions * 12;
      rate = 15;
    } else {
      // Общий: 30% до лимита, 15.1% сверх
      const limit = 2979000;
      if (annualPayroll <= limit) {
        contributions = annualPayroll * 0.30;
        rate = 30;
      } else {
        contributions = limit * 0.30 + (annualPayroll - limit) * 0.151;
        rate = 15.1;
      }
    }

    return {
      annual_contributions: Math.round(contributions * 100) / 100,
      monthly_contributions: Math.round((contributions / 12) * 100) / 100,
      rate
    };
  }
}

export const taxEngine = new TaxEngine();