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

  private settings: any = {};

  async loadSettings(settings: any[]) {
    for (const s of settings) {
      this.settings[s.key] = s.value;
    }
  }

  calculateTax(
    company: Company,
    transactions: Transaction[],
    accounts: Account[],
    periodStart: string,
    periodEnd: string
  ): TaxCalculation {

    const companyTx = transactions.filter(t => {
      const txDate = this.getDateStr(t.date);
      return t.company_id === company.id && txDate >= periodStart && txDate <= periodEnd;
    });

    // Определяем долю периода в году
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const daysInPeriod = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const periodFraction = daysInPeriod / 365; // Доля года

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
        // Для определения ставки НДС используем годовую выручку
        vatRate = this.getVatRateForUSN(revenue / periodFraction);
        vatAmount = revenue * vatRate;
        incomeTaxRate = parseFloat(this.settings['usn_6'] || '0.06');
        incomeTaxAmount = revenue * incomeTaxRate;
        break;

      case 'USN_15':
        vatRate = this.getVatRateForUSN(revenue / periodFraction);
        vatAmount = revenue * vatRate;
        incomeTaxRate = parseFloat(this.settings['usn_15'] || '0.15');
        const taxBase = Math.max(0, revenue - expenses);
        incomeTaxAmount = taxBase * incomeTaxRate;
        const minimumTax = revenue * parseFloat(this.settings['usn_min_tax'] || '0.01');
        if (incomeTaxAmount < minimumTax) incomeTaxAmount = minimumTax;
        break;

      case 'OSNO':
        vatRate = parseFloat(this.settings['vat_osno'] || '0.22');
        vatAmount = revenue * vatRate;
        incomeTaxRate = parseFloat(this.settings['profit_tax'] || '0.25');
        incomeTaxAmount = Math.max(0, profit) * incomeTaxRate;
        break;
    }

    // Страховые взносы и НДФЛ — пропорционально периоду
    const insurance = this.calculateInsuranceContributions(company, revenue / periodFraction);
    const insuranceAmount = insurance.annual_contributions * periodFraction;
    const ndflAmount = (insurance.ndfl_annual || 0) * periodFraction;
    const totalPayrollCost = (insurance.total_payroll_cost || 0) * periodFraction;

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
   * Принимает budgetMonths — реальные месяцы горизонта планирования
   */
  getMonthlyTaxCalendar(
    company: Company,
    year: string,
    budgets: Budget[],
    budgetMonths?: string[]
  ): { month: string; taxes: { [key: string]: number } }[] {

    const months = budgetMonths && budgetMonths.length > 0
      ? budgetMonths.map(m => this.getDateStr(m).substring(0, 7))
      : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

    const calendar: { month: string; taxes: { [key: string]: number } }[] = [];

    const revenueByMonth = new Map<string, number>();
    for (const budget of budgets) {
      if (budget.company_id !== company.id) continue;
      const accountId = budget.category_id || budget.account_id;
      if (accountId !== 'acc-in-revenue') continue;
      const rawPeriod = String(budget.period || '').replace(/^'/, '');
      const month = rawPeriod.substring(0, 7);
      revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + budget.planned_amount);
    }

    const insurance = this.calculateInsuranceContributions(company, 0);
    const monthlyInsurance = insurance.monthly_contributions;
    const monthlyNdfl = insurance.ndfl_monthly || 0;
    const ipFixed = company.is_individual ? 57390 : 0;

    for (const monthKey of months) {
      const taxes: { [key: string]: number } = {};
      const monthRevenue = revenueByMonth.get(monthKey) || 0;
      const monthNum = parseInt(monthKey.substring(5, 7));

      if (company.has_employees || company.monthly_payroll > 0) {
        taxes['acc-tax-insurance'] = Math.round(monthlyInsurance * 100) / 100;
        taxes['acc-tax-ndfl'] = Math.round(monthlyNdfl * 100) / 100;
      }

      if (monthNum === 4 || monthNum === 7 || monthNum === 10) {
        const vatRate = this.getVatRateForUSN(monthRevenue * 3);
        if (vatRate > 0) {
          taxes['acc-tax-vat'] = Math.round((monthRevenue * 3 * vatRate) * 100) / 100;
        }
        if (company.tax_system === 'USN_6') {
          taxes['acc-tax-usn'] = Math.round((monthRevenue * 3 * 0.06) * 100) / 100;
        } else if (company.tax_system === 'USN_15') {
          taxes['acc-tax-usn'] = Math.round((monthRevenue * 3 * 0.15) * 100) / 100;
        } else if (company.tax_system === 'OSNO') {
          taxes['acc-tax-profit'] = Math.round((monthRevenue * 3 * 0.25) * 100) / 100;
        }
      }

      if (monthNum === 12 && company.is_individual) {
        taxes['acc-tax-ip'] = ipFixed;
      }

      calendar.push({ month: monthKey, taxes });
    }

    return calendar;
  }

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
      contributions = (monthlyBase * 0.30 + excess * 0.15) * 12;
      rate = 15;
    } else {
      const limit = parseFloat(this.settings['insurance_limit'] || '2979000');
      const baseRate = parseFloat(this.settings['insurance_base_rate'] || '0.30');
      const reducedRate = parseFloat(this.settings['insurance_reduced_rate'] || '0.151');
      if (annualPayroll <= limit) {
        contributions = annualPayroll * baseRate;
        rate = baseRate * 100;
      } else {
        contributions = limit * baseRate + (annualPayroll - limit) * reducedRate;
        rate = reducedRate * 100;
      }
    }

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

  private getVatRateForUSN(revenue: number): number {
    const exemptLimit = parseFloat(this.settings['usn_vat_exempt_limit'] || '20000000');
    const rate5Limit = parseFloat(this.settings['usn_vat_5_limit'] || '250000000');
    const rate7Limit = parseFloat(this.settings['usn_vat_7_limit'] || '490500000');
    const rate5 = parseFloat(this.settings['vat_usn_5'] || '0.05');
    const rate7 = parseFloat(this.settings['vat_usn_7'] || '0.07');
    const standardRate = parseFloat(this.settings['vat_osno'] || '0.22');

    if (revenue <= exemptLimit) return 0;
    else if (revenue <= rate5Limit) return rate5;
    else if (revenue <= rate7Limit) return rate7;
    else return standardRate;
  }

  checkUSNLimits(company: Company, transactions: Transaction[]): {
    current_revenue: number;
    limit: number;
    percentage: number;
    vat_required: boolean;
    vat_rate: number;
  } {
    const currentYear = new Date().getFullYear().toString();
    const yearTx = transactions.filter(t => {
      const txDate = this.getDateStr(t.date);
      return t.company_id === company.id && txDate.startsWith(currentYear);
    });

    const revenue = yearTx
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);

    return {
      current_revenue: revenue,
      limit: 490500000,
      percentage: Math.round((revenue / 490500000) * 10000) / 100,
      vat_required: revenue > 20000000,
      vat_rate: this.getVatRateForUSN(revenue)
    };
  }

  private getDateStr(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') return date.split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return String(date).split('T')[0];
  }
}

export const taxEngine = new TaxEngine();