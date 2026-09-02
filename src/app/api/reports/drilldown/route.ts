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
    const rowType = url.searchParams.get('type');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    const companyId = url.searchParams.get('company_id');
    
    const [transactions, accounts] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts')
    ]);
    
    let filtered = transactions.filter((t: any) => {
      const txDate = t.date?.split('T')[0] || t.date;
      return txDate >= periodStart && txDate <= periodEnd;
    });
    
    if (companyId) {
      filtered = filtered.filter((t: any) => t.company_id === companyId);
    }
    
    // Фильтрация по статье (счёту)
    if (accountId && accountId !== 'revenue' && accountId !== 'cogs' && accountId !== 'gross' && 
        accountId !== 'opex' && accountId !== 'depreciation' && accountId !== 'taxes' && accountId !== 'net' &&
        accountId !== 'start' && accountId !== 'op_in' && accountId !== 'op_out' && 
        accountId !== 'inv_in' && accountId !== 'inv_out' && accountId !== 'fin_in' && 
        accountId !== 'fin_out' && accountId !== 'end') {
      filtered = filtered.filter((t: any) => 
        t.debit_account_id === accountId || t.credit_account_id === accountId
      );
    }
    
    // Фильтрация по типу (доход/расход)
    if (rowType === 'income') {
      filtered = filtered.filter((t: any) => t.type === 'income');
    } else if (rowType === 'expense') {
      filtered = filtered.filter((t: any) => t.type === 'expense');
    }
    
    // Обогащаем
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