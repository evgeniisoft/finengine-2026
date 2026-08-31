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
    const accountId = url.searchParams.get('account_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    const [transactions, accounts] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts')
    ]);
    
    // Фильтруем по периоду
    let filtered = transactions.filter(t => 
      t.date >= periodStart && t.date <= periodEnd
    );
    
    // Если указан счёт — фильтруем по нему
    if (accountId && accountId !== 'gross' && accountId !== 'opex') {
      filtered = filtered.filter(t => 
        t.debit_account_id === accountId || t.credit_account_id === accountId
      );
    }
    
    // Обогащаем названиями счетов
    const enriched = filtered.map(t => {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);
      return {
        ...t,
        debit_account_name: debitAccount?.name || t.debit_account_id,
        credit_account_name: creditAccount?.name || t.credit_account_id,
      };
    });
    
    return NextResponse.json(enriched);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}