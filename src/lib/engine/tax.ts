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
 * - Страховые взносы: 30% (до лимита), 15.1% (свыше)
 * - НДФЛ: 13% (до 5 млн), 15% (свыше)
 */

import { Company, Transaction, Account, Budget } from './types';

export interface TaxCalculation {
  company_id: string;
  company_name: string;
  tax_system: string;
  revenue_without_vat: number;
  expenses_without_vat: number;
  profit_before_tax: number;
  vat_rate: number;
  vat_amount: number;
  outgoing_vat: number;
  incoming_vat: number;
  vat_to_pay: number;
  income_tax_rate: number;
  income_tax_amount: number;
  insurance_rate: number;
  insurance_amount: number;
  ndfl_amount: number;
  total_payroll_cost: number;
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

    const companyTx = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return t.company_id === company.id && txDate >= periodStart && txDate <= periodEnd;
    });

    const revenue = companyTx
      .filter(t => {
        const creditAccount = accounts.find(a => a.id === t.credit_account_id);
        return creditAccount?.type === 'I';
      })
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    const expenses = companyTx
      .filter(t => {
        const debitAccount = accounts.find(a => a.id === t.debit_account_id);
        return debitAccount?.type === 'X';
      })
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    const profit = revenue - expenses;

    let vatRate = 0;
    let incomeTaxRate = 0;
    let vatAmount = 0;
    let incomeTaxAmount = 0;

    switch (company.tax_system) {
      case 'USN_6':
        vatRate = this.getVatRateForUSN(revenue);
        vatAmount = revenue * vatRate;
        incomeTaxRate = 0.06;
        incomeTaxAmount = revenue * incomeTaxRate;
        break;

      case 'USN_15':
        vatRate = this.getVatRateForUSN(revenue);
        vatAmount = revenue * vatRate;
        incomeTaxRate = 0.15;
        const taxBase = Math.max(0, revenue - expenses);
        incomeTaxAmount = taxBase * incomeTaxRate;
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
    }

    // Страховые взносы
    const insurance = this.calculateInsuranceContributions(company, revenue);
    const insuranceAmount = insurance.annual_contributions;
    const ndflAmount = insurance.ndfl_annual || 0;
    const totalPayrollCost = insurance.total_payroll_cost || 0;

    // УСН 6% уменьшается на взносы
    let finalIncomeTax = incomeTaxAmount;
    if (company.tax_system === 'USN_6') {
      const isIndividual = Boolean(company.is_individual);
      const maxReduction = isIndividual ? incomeTaxAmount : incomeTaxAmount * 0.5;
      finalIncomeTax = Math.max(incomeTaxAmount - Math.min(insuranceAmount, maxReduction), 0);
    }

    const outgoingVat = revenue * vatRate;
    const incomingVat = companyTx
      .filter(t => t.vat_direction === 'incoming')
      .reduce((sum, t) => sum + parseFloat(String(t.vat_amount || 0)), 0);
    const vatToPay = Math.max(0, outgoingVat - incomingVat);

    const totalTax = vatToPay + finalIncomeTax + insuranceAmount;

    return {
      company_id: company.id,
      company_name: company.name,
      tax_system: company.tax_system,
      revenue_without_vat: revenue,
      expenses_without_vat: expenses,
      profit_before_tax: profit,
      vat_rate: vatRate,
      vat_amount: Math.round(vatAmount * 100) / 100,
      outgoing_vat: Math.round(outgoingVat * 100) / 100,
      incoming_vat: Math.round(incomingVat * 100) / 100,
      vat_to_pay: Math.round(vatToPay * 100) / 100,
      income_tax_rate: incomeTaxRate,
      income_tax_amount: Math.round(finalIncomeTax * 100) / 100,
      insurance_rate: insurance.rate,
      insurance_amount: Math.round(insuranceAmount * 100) / 100,
      ndfl_amount: Math.round(ndflAmount * 100) / 100,
      total_payroll_cost: Math.round(totalPayrollCost * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      effective_tax_rate: revenue > 0 ? Math.round((totalTax / revenue) * 10000) / 100 : 0
    };
  }

  /**
   * Налоговый календарь на год (помесячно)
   */
  getMonthlyTaxCalendar(
    company: Company,
    year: string,
    budgets: Budget[]
  ): { month: string; taxes: { [key: string]: number } }[] {

    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const calendar: { month: string; taxes: { [key: string]: number } }[] = [];

    // Плановая выручка по месяцам из бюджета
    const revenueByMonth = new Map<string, number>();
    for (const budget of budgets) {
      if (budget.company_id !== company.id) continue;
      const accountId = budget.category_id || budget.account_id;
      if (accountId !== 'acc-in-revenue') continue;
      const rawPeriod = String(budget.period || '');
      const month = rawPeriod.replace(/^'/, '').substring(0, 7);
      revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + budget.planned_amount);
    }

    // Ежемесячные налоги (взносы, НДФЛ)
    const insurance = this.calculateInsuranceContributions(company, 0);
    const monthlyInsurance = insurance.monthly_contributions;
    const monthlyNdfl = insurance.ndfl_monthly || 0;

    // Взносы ИП
    const ipFixed = company.is_individual ? 57390 : 0;

    for (const month of months) {
      const taxes: { [key: string]: number } = {};
      const monthKey = `${year}-${month}`;
      const monthRevenue = revenueByMonth.get(monthKey) || 0;

      // Ежемесячные
      if (company.has_employees || company.monthly_payroll > 0) {
        taxes['acc-tax-insurance'] = Math.round(monthlyInsurance * 100) / 100;
        taxes['acc-tax-ndfl'] = Math.round(monthlyNdfl * 100) / 100;
      }

      // Квартальные (апрель, июль, октябрь)
      if (month === '04' || month === '07' || month === '10') {
        // НДС
        const vatRate = this.getVatRateForUSN(monthRevenue * 3); // квартальная выручка
        if (vatRate > 0) {
          taxes['acc-tax-vat'] = Math.round((monthRevenue * 3 * vatRate) * 100) / 100;
        }

        // УСН аванс или налог на прибыль
        if (company.tax_system === 'USN_6') {
          taxes['acc-tax-usn'] = Math.round((monthRevenue * 3 * 0.06) * 100) / 100;
        } else if (company.tax_system === 'USN_15') {
          taxes['acc-tax-usn'] = Math.round((monthRevenue * 3 * 0.15) * 100) / 100;
        } else if (company.tax_system === 'OSNO') {
          taxes['acc-tax-profit'] = Math.round((monthRevenue * 3 * 0.25) * 100) / 100;
        }
      }

      // Декабрь — взносы ИП
      if (month === '12' && company.is_individual) {
        taxes['acc-tax-ip'] = ipFixed;
      }

      calendar.push({ month: monthKey, taxes });
    }

    return calendar;
  }

  /**
   * Расчёт страховых взносов
   */
  calculateInsuranceContributions(company: Company, revenue: number = 0): {
    annual_contributions: number;
    monthly_contributions: number;
    rate: number;
    ndfl_annual: number;
    ndfl_monthly: number;
    total_payroll_cost: number;
  } {
    const payroll = company.monthly_payroll || 0;
    const annualPayroll = payroll * 12;

    let contributions = 0;
    let rate = 0;

    if (Boolean(company.is_individual)) {
      contributions = 57390;
      if (revenue > 300000) {
        const additional = (revenue - 300000) * 0.01;
        contributions += Math.min(additional, 321818);
      }
      rate = 0;
    } else if (company.industry_type === 'it') {
      const limit = 2979000;
      if (annualPayroll <= limit) {
        contributions = annualPayroll * 0.15;
        rate = 15;
      } else {
        contributions = limit * 0.15 + (annualPayroll - limit) * 0.076;
        rate = 7.6;
      }
    } else if (company.industry_type === 'msp_priority') {
      const mrot = 27093;
      const threshold = mrot * 1.5;
      const monthlyBase = Math.min(payroll, threshold);
      const excess = Math.max(0, payroll - threshold);
      const monthlyContributions = monthlyBase * 0.30 + excess * 0.15;
      contributions = monthlyContributions * 12;
      rate = 15;
    } else {
      const limit = 2979000;
      if (annualPayroll <= limit) {
        contributions = annualPayroll * 0.30;
        rate = 30;
      } else {
        contributions = limit * 0.30 + (annualPayroll - limit) * 0.151;
        rate = 15.1;
      }
    }

    // НДФЛ
    const ndflLimit = 5000000;
    let ndfl = 0;
    if (annualPayroll <= ndflLimit) {
      ndfl = annualPayroll * 0.13;
    } else {
      ndfl = ndflLimit * 0.13 + (annualPayroll - ndflLimit) * 0.15;
    }

    return {
      annual_contributions: Math.round(contributions * 100) / 100,
      monthly_contributions: Math.round((contributions / 12) * 100) / 100,
      rate,
      ndfl_annual: Math.round(ndfl * 100) / 100,
      ndfl_monthly: Math.round((ndfl / 12) * 100) / 100,
      total_payroll_cost: Math.round((annualPayroll + contributions + ndfl) * 100) / 100
    };
  }

  /**
   * Определение ставки НДС для УСН по выручке
   */
  private getVatRateForUSN(revenue: number): number {
    if (revenue <= 20000000) {
      return 0;
    } else if (revenue <= 250000000) {
      return 0.05;
    } else if (revenue <= 490500000) {
      return 0.07;
    } else {
      return 0.22;
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
}

export const taxEngine = new TaxEngine();