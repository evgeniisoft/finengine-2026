import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function gasCreate(sheet: string, data: any): Promise<any> {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', sheet, data })
  });
  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');
    const scenario = url.searchParams.get('scenario') || 'base';
    const year = url.searchParams.get('year') || '2026';
    
    const [budgets, transactions, accounts, companies] = await Promise.all([
      gasGet('Budgets'),
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies')
    ]);
    
    // Фильтруем бюджеты
    let filteredBudgets = budgets.filter(b => 
      b.period?.startsWith(year) && 
      b.scenario === scenario
    );
    if (companyId) {
      filteredBudgets = filteredBudgets.filter(b => b.company_id === companyId);
    }
    
    // Считаем фактические данные
    const actuals = transactions.filter(t => {
      const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
      return txDate.startsWith(year);
    });
    
    return NextResponse.json({
      budgets: filteredBudgets,
      actuals,
      accounts,
      companies
    });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;
    
    if (action === 'create_budget') {
      const result = await gasCreate('Budgets', body.data);
      return NextResponse.json(result);
    }
    
    if (action === 'auto_fill') {
      // Автозаполнение на основе прошлых данных
      const { transactions, accounts, companyId, year } = body;
      const budgets: any[] = [];
      
      // Логика автозаполнения
      // ...
      
      return NextResponse.json({ budgets });
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}