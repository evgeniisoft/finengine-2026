/**
 * ============================================
 * FinEngine 2026 - Модуль прогнозирования
 * ============================================
 * Прогноз кассовых разрывов, Run Rate,
 * предиктивная модель на основе лидов.
 */

import { Transaction, CashFlowForecast, Budget } from './types';

export class ForecastEngine {
  
  /**
   * Расчёт Run Rate
   * Прогноз выполнения плана по выручке на конец месяца
   */
  calculateRunRate(
    currentMonthRevenue: number,
    daysPassed: number,
    totalDaysInMonth: number
  ): {
    run_rate: number;
    projected_month_end: number;
    daily_average: number;
  } {
    
    const dailyAverage = currentMonthRevenue / daysPassed;
    const projectedMonthEnd = dailyAverage * totalDaysInMonth;
    
    return {
      run_rate: dailyAverage,
      projected_month_end: projectedMonthEnd,
      daily_average: dailyAverage
    };
  }
  
  /**
   * Прогноз кассовых разрывов
   * На основе плановых поступлений и платежей
   */
  forecastCashFlow(
    companyId: string,
    currentBalance: number,
    startDate: string,
    days: number,
    plannedInflows: { date: string; amount: number }[],
    plannedOutflows: { date: string; amount: number }[]
  ): CashFlowForecast[] {
    
    const forecasts: CashFlowForecast[] = [];
    let balance = currentBalance;
    
    for (let i = 0; i < days; i++) {
      const date = this.addDays(startDate, i);
      
      // Суммируем поступления на этот день
      const inflow = plannedInflows
        .filter(item => item.date === date)
        .reduce((sum, item) => sum + item.amount, 0);
      
      // Суммируем платежи на этот день
      const outflow = plannedOutflows
        .filter(item => item.date === date)
        .reduce((sum, item) => sum + item.amount, 0);
      
      balance = balance + inflow - outflow;
      
      forecasts.push({
        date,
        company_id: companyId,
        starting_balance: balance - inflow + outflow,
        inflows: inflow,
        outflows: outflow,
        ending_balance: balance
      });
    }
    
    return forecasts;
  }
  
  /**
   * Предиктивная модель выручки
   * На основе лидов, конверсии и среднего чека
   */
  predictRevenue(
    leads: number,
    conversionRate: number, // 0.2 = 20%
    averageCheck: number,
    salesCycleDays: number,
    seasonalityFactor: number = 1
  ): {
    predicted_revenue: number;
    predicted_deals: number;
    confidence: number;
  } {
    
    const predictedDeals = leads * conversionRate;
    const predictedRevenue = predictedDeals * averageCheck * seasonalityFactor;
    
    // Уровень уверенности (чем больше лидов, тем выше точность)
    const confidence = Math.min(0.95, 0.5 + (leads / 100));
    
    return {
      predicted_revenue: Math.round(predictedRevenue * 100) / 100,
      predicted_deals: Math.round(predictedDeals * 10) / 10,
      confidence
    };
  }
  
  /**
   * Прогноз на основе исторической сезонности
   */
  forecastWithSeasonality(
    historicalMonthly: { month: string; revenue: number }[],
    monthsToForecast: number
  ): { month: string; forecasted_revenue: number }[] {
    
    if (historicalMonthly.length < 3) return [];
    
    // Рассчитываем среднемесячный рост
    const growthRates: number[] = [];
    for (let i = 1; i < historicalMonthly.length; i++) {
      const prev = historicalMonthly[i - 1].revenue;
      const current = historicalMonthly[i].revenue;
      if (prev > 0) {
        growthRates.push(current / prev);
      }
    }
    
    const averageGrowth = growthRates.length > 0
      ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
      : 1;
    
    // Рассчитываем сезонные коэффициенты
    const seasonalFactors = this.calculateSeasonality(historicalMonthly);
    
    // Строим прогноз
    const forecasts: { month: string; forecasted_revenue: number }[] = [];
    const lastMonth = historicalMonthly[historicalMonthly.length - 1];
    let lastRevenue = lastMonth.revenue;
    let lastMonthStr = lastMonth.month;
    
    for (let i = 0; i < monthsToForecast; i++) {
      const nextMonth = this.getNextMonth(lastMonthStr);
      const monthNumber = parseInt(nextMonth.split('-')[1]);
      const seasonality = seasonalFactors[monthNumber] || 1;
      
      const forecasted = lastRevenue * averageGrowth * seasonality;
      
      forecasts.push({
        month: nextMonth,
        forecasted_revenue: Math.round(forecasted * 100) / 100
      });
      
      lastRevenue = forecasted;
      lastMonthStr = nextMonth;
    }
    
    return forecasts;
  }
  
  /**
   * Расчёт сезонных коэффициентов по месяцам
   */
  private calculateSeasonality(
    historicalMonthly: { month: string; revenue: number }[]
  ): { [month: number]: number } {
    
    const monthlyAverages: { [month: number]: number[] } = {};
    
    for (const item of historicalMonthly) {
      const month = parseInt(item.month.split('-')[1]);
      if (!monthlyAverages[month]) {
        monthlyAverages[month] = [];
      }
      monthlyAverages[month].push(item.revenue);
    }
    
    // Среднее по всем месяцам
    const allRevenues = historicalMonthly.map(item => item.revenue);
    const overallAverage = allRevenues.reduce((sum, r) => sum + r, 0) / allRevenues.length;
    
    // Коэффициент для каждого месяца
    const factors: { [month: number]: number } = {};
    for (const month in monthlyAverages) {
      const revenues = monthlyAverages[month];
      const monthAverage = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
      factors[month] = monthAverage / overallAverage;
    }
    
    return factors;
  }
  
  /**
   * Вспомогательные функции
   */
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
  
  private getNextMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month, 1); // Следующий месяц
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}

export const forecastEngine = new ForecastEngine();