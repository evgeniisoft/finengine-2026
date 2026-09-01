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
    const type = url.searchParams.get('type') || 'all';
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    const companyId = url.searchParams.get('company_id');
    
    const [transactions, accounts] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts')
    ]);
    
    let filtered = transactions.filter((t: any) => 
      t.date >= periodStart && t.date <= periodEnd
    );
    
    if (companyId) {
      filtered = filtered.filter((t: any) => t.company_id === companyId);
    }
    
    // Фильтруем по типу
    if (type === 'income') {
      filtered = filtered.filter((t: any) => t.type === 'income');
    } else if (type === 'expense') {
      filtered = filtered.filter((t: any) => t.type === 'expense');
    }
    
    // Обогащаем названиями счетов
    const enriched = filtered.map((t: any) => {
      const debitAccount = accounts.find((a: any) => a.id === t.debit_account_id);
      const creditAccount = accounts.find((a: any) => a.id === t.credit_account_id);
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