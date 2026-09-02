import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    const [transactions, accounts, companies] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies')
    ]);
    
    // Фильтруем по периоду
    const periodTx = transactions.filter((t: any) => {
      const txDate = t.date?.split('T')[0] || t.date;
      return txDate >= periodStart && txDate <= periodEnd;
    });
    
    // Ключевые показатели
    const totalRevenue = periodTx
      .filter((t: any) => t.type === 'income')
      .reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    
    const totalExpenses = periodTx
      .filter((t: any) => t.type === 'expense')
      .reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
    
    const totalProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Деньги на счетах
    const cashAccounts = accounts.filter((a: any) => 
      a.is_cash_flow === 'true' || a.is_cash_flow === true
    );
    
    const totalCash = cashAccounts.reduce((s: number, a: any) => {
      const accountTx = transactions.filter((t: any) =>
        t.debit_account_id === a.id || t.credit_account_id === a.id
      );
      const balance = accountTx.reduce((sum: number, t: any) => {
        if (t.debit_account_id === a.id) return sum + parseFloat(t.amount || 0);
        if (t.credit_account_id === a.id) return sum - parseFloat(t.amount || 0);
        return sum;
      }, 0);
      return s + balance;
    }, 0);
    
    // Кассовые разрывы (ближайшие 30 дней)
    const today = new Date();
    const gaps: any[] = [];
    let runningBalance = totalCash;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTx = transactions.filter((t: any) => t.date?.startsWith(dateStr));
      const inflow = dayTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
      const outflow = dayTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
      
      runningBalance += inflow - outflow;
      
      if (runningBalance < 0) {
        gaps.push({ date: dateStr, deficit: Math.abs(runningBalance), balance: runningBalance });
      }
    }
    
    // Структура расходов
    const expenseAccounts = accounts.filter((a: any) => a.type === 'X');
    const expensesByCategory = expenseAccounts.map((a: any) => {
      const amount = periodTx
        .filter((t: any) => t.debit_account_id === a.id)
        .reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
      return { id: a.id, name: a.name, amount };
    }).filter((e: any) => e.amount > 0).sort((a: any, b: any) => b.amount - a.amount);
    
    // Выручка по компаниям
    const revenueByCompany = companies.map((c: any) => {
      const revenue = periodTx
        .filter((t: any) => t.company_id === c.id && t.type === 'income')
        .reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
      return { company: c, revenue };
    });
    
    return NextResponse.json({
      kpi: {
        total_cash: totalCash,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_profit: totalProfit,
        margin: Math.round(margin * 100) / 100,
      },
      cash_gaps: gaps,
      expenses_by_category: expensesByCategory,
      revenue_by_company: revenueByCompany,
      period: { start: periodStart, end: periodEnd }
    });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}