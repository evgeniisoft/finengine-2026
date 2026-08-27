import { NextRequest, NextResponse } from 'next/server';
import { forecastEngine } from '@/lib/engine/forecast';
import { api } from '@/lib/api';

/**
 * GET /api/forecast
 * Получение прогнозов
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const companyId = url.searchParams.get('company_id');
    
    // Получаем данные
    const transactions = await api.getAll('Transactions');
    
    // Фильтруем по компании
    const companyTransactions = companyId
      ? transactions.filter(t => t.company_id === companyId)
      : transactions;
    
    switch (type) {
      case 'cashflow':
        // Прогноз кассовых разрывов
        const currentBalance = 1000000; // TODO: брать из Баланса
        const startDate = new Date().toISOString().split('T')[0];
        
        // Получаем плановые поступления и платежи из бюджета
        const plannedInflows = companyTransactions
          .filter(t => t.credit_account_id === 'acc-rev-001')
          .map(t => ({ date: t.date, amount: t.amount_rub }));
        
        const plannedOutflows = companyTransactions
          .filter(t => t.debit_account_id === 'acc-exp-001')
          .map(t => ({ date: t.date, amount: t.amount_rub }));
        
        const forecast = forecastEngine.forecastCashFlow(
          companyId || 'comp-demo-001',
          currentBalance,
          startDate,
          30,
          plannedInflows,
          plannedOutflows
        );
        
        return NextResponse.json(forecast);
        
      case 'runrate':
        // Run Rate
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysPassed = now.getDate();
        
        const currentMonth = now.toISOString().substring(0, 7);
        const monthTransactions = companyTransactions.filter(t =>
          t.date.startsWith(currentMonth) &&
          t.credit_account_id === 'acc-rev-001'
        );
        
        const monthRevenue = monthTransactions.reduce(
          (sum, t) => sum + t.amount_rub,
          0
        );
        
        const runRate = forecastEngine.calculateRunRate(
          monthRevenue,
          daysPassed,
          daysInMonth
        );
        
        return NextResponse.json(runRate);
        
      case 'revenue':
        // Предиктивная модель
        const leads = parseInt(url.searchParams.get('leads') || '100');
        const conversionRate = parseFloat(url.searchParams.get('conversion') || '0.2');
        const averageCheck = parseFloat(url.searchParams.get('check') || '50000');
        
        const prediction = forecastEngine.predictRevenue(
          leads,
          conversionRate,
          averageCheck,
          30
        );
        
        return NextResponse.json(prediction);
        
      default:
        return NextResponse.json({ error: 'Unknown forecast type' });
    }
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}