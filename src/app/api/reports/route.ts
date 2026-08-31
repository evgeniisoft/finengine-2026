import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'pnl';
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    const [transactions, accounts, companies] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies')
    ]);
    
    // Простые отчёты
    if (reportType === 'transactions') {
      return NextResponse.json(transactions);
    }
    
    return NextResponse.json({
      transactions: transactions.length,
      accounts: accounts.length,
      companies: companies.length
    });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}