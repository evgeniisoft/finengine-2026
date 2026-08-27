import { NextRequest, NextResponse } from 'next/server';
import { monthlyEngine } from '@/lib/engine/monthly';
import { api } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    const periodType = url.searchParams.get('period_type') || 'monthly';
    
    const [transactions, accounts] = await Promise.all([
      api.getAll('Transactions'),
      api.getAll('Accounts')
    ]);
    
    let data;
    
    if (companyId) {
      data = monthlyEngine.getPeriodBreakdown(
        transactions,
        accounts,
        companyId,
        periodStart,
        periodEnd,
        periodType as any
      );
    } else {
      // Агрегируем по всем компаниям
      const companies = await api.getAll('Companies');
      
      const allData = companies.flatMap(company =>
        monthlyEngine.getPeriodBreakdown(
          transactions,
          accounts,
          company.id,
          periodStart,
          periodEnd,
          periodType as any
        )
      );
      
      // Агрегируем по периодам
      const periodsMap = new Map<string, any>();
      
      for (const item of allData) {
        if (!periodsMap.has(item.period)) {
          periodsMap.set(item.period, { ...item });
        } else {
          const existing = periodsMap.get(item.period)!;
          existing.revenue += item.revenue;
          existing.expenses += item.expenses;
          existing.profit += item.profit;
          existing.cash_in += item.cash_in;
          existing.cash_out += item.cash_out;
          existing.net_cash_flow += item.net_cash_flow;
          existing.ending_balance += item.ending_balance;
          // Агрегируем детали
          for (const accountId in item.details) {
            existing.details[accountId] = (existing.details[accountId] || 0) + item.details[accountId];
          }
        }
      }
      
      data = Array.from(periodsMap.values())
        .sort((a, b) => a.period.localeCompare(b.period));
    }
    
    // Возвращаем вместе со счетами для расшифровки
    return NextResponse.json({
      periods: data,
      accounts: accounts
    });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}