import { NextRequest, NextResponse } from 'next/server';
import { monthlyEngine } from '@/lib/engine/monthly';
import { api } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    // Получаем данные
    const [transactions, accounts] = await Promise.all([
      api.getAll('Transactions'),
      api.getAll('Accounts')
    ]);
    
    let monthlyData;
    
    if (companyId) {
      // По одной компании
      monthlyData = monthlyEngine.getMonthlyBreakdown(
        transactions,
        accounts,
        companyId,
        periodStart,
        periodEnd
      );
    } else {
      // По всем компаниям (агрегируем)
      const companies = await api.getAll('Companies');
      
      const allMonthly = companies.flatMap(company => 
        monthlyEngine.getMonthlyBreakdown(
          transactions,
          accounts,
          company.id,
          periodStart,
          periodEnd
        )
      );
      
      // Агрегируем по месяцам
      const monthsMap = new Map<string, any>();
      
      for (const monthly of allMonthly) {
        if (!monthsMap.has(monthly.month)) {
          monthsMap.set(monthly.month, { ...monthly });
        } else {
          const existing = monthsMap.get(monthly.month)!;
          existing.revenue += monthly.revenue;
          existing.expenses += monthly.expenses;
          existing.profit += monthly.profit;
          existing.cash_in += monthly.cash_in;
          existing.cash_out += monthly.cash_out;
          existing.net_cash_flow += monthly.net_cash_flow;
          existing.ending_balance += monthly.ending_balance;
        }
      }
      
      monthlyData = Array.from(monthsMap.values())
        .sort((a, b) => a.month.localeCompare(b.month));
    }
    
    return NextResponse.json(monthlyData);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}