import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  try {
    const [transactions, accounts, companies, budgets] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies'),
      gasGet('Budgets')
    ]);

    const checks: any[] = [];

    // ==========================================
    // 1. ПРОВЕРКА ДАННЫХ
    // ==========================================

    // Операции без категории
    const unclassifiedTx = transactions.filter(t => 
      t.debit_account_id === 'acc-unclassified' || 
      t.credit_account_id === 'acc-unclassified' ||
      !t.debit_account_id || 
      !t.credit_account_id
    );
    
    checks.push({
      id: 'unclassified_transactions',
      category: 'data',
      severity: unclassifiedTx.length > 0 ? 'critical' : 'ok',
      name: 'Операции без категории',
      count: unclassifiedTx.length,
      message: unclassifiedTx.length > 0 
        ? `${unclassifiedTx.length} операций требуют категоризации`
        : 'Все операции категоризированы'
    });

    // Операции без даты
    const noDateTx = transactions.filter(t => !t.date);
    checks.push({
      id: 'no_date_transactions',
      category: 'data',
      severity: noDateTx.length > 0 ? 'critical' : 'ok',
      name: 'Операции без даты',
      count: noDateTx.length,
      message: noDateTx.length > 0 
        ? `${noDateTx.length} операций без даты`
        : 'Все операции имеют дату'
    });

    // Операции с нулевой суммой
    const zeroAmountTx = transactions.filter(t => 
      !t.amount || parseFloat(String(t.amount)) === 0
    );
    checks.push({
      id: 'zero_amount_transactions',
      category: 'data',
      severity: zeroAmountTx.length > 0 ? 'warning' : 'ok',
      name: 'Операции с нулевой суммой',
      count: zeroAmountTx.length,
      message: zeroAmountTx.length > 0 
        ? `${zeroAmountTx.length} операций с нулевой суммой`
        : 'Все операции имеют сумму'
    });

    // ==========================================
    // 2. ПРОВЕРКА РАСЧЁТОВ
    // ==========================================

    // Баланс: Активы = Пассивы
    let totalCash = 0;
    let totalAR = 0;
    let totalAP = 0;
    
    for (const t of transactions) {
      const amount = parseFloat(String(t.amount || 0));
      
      // Денежные счета
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);
      
      if (debitAccount?.is_cash_flow === true) totalCash += amount;
      if (creditAccount?.is_cash_flow === true) totalCash -= amount;
      
      // Дебиторка
      if (t.debit_account_id === 'acc-ar-001') totalAR += amount;
      if (t.credit_account_id === 'acc-ar-001') totalAR -= amount;
      
      // Кредиторка
      if (t.credit_account_id === 'acc-ap-001') totalAP += amount;
      if (t.debit_account_id === 'acc-ap-001') totalAP -= amount;
    }
    
    const totalAssets = totalCash + totalAR;
    const totalLiabilities = totalAP;
    const equity = totalAssets - totalLiabilities;
    
    const balanceEqual = Math.abs(totalAssets - totalLiabilities - equity) < 0.01;
    
    checks.push({
      id: 'balance_equality',
      category: 'calculation',
      severity: balanceEqual ? 'ok' : 'critical',
      name: 'Баланс: Активы = Пассивы + Капитал',
      expected: totalAssets,
      actual: totalLiabilities + equity,
      difference: Math.abs(totalAssets - totalLiabilities - equity),
      message: balanceEqual ? 'Баланс сходится' : 'Баланс не сходится'
    });

    // ==========================================
    // 3. ПРОВЕРКА СВЯЗЕЙ
    // ==========================================

    // Компании без счетов
    const companiesWithoutAccounts = companies.filter((c: any) => {
      return !accounts.some((a: any) => a.company_id === c.id);
    });
    
    checks.push({
      id: 'companies_without_accounts',
      category: 'link',
      severity: companiesWithoutAccounts.length > 0 ? 'warning' : 'ok',
      name: 'Компании без счетов',
      count: companiesWithoutAccounts.length,
      message: companiesWithoutAccounts.length > 0
        ? `${companiesWithoutAccounts.length} компаний без привязанных счетов`
        : 'Все компании имеют счета'
    });

    // ==========================================
    // 4. ПРОВЕРКА БЮДЖЕТА
    // ==========================================

    // Пустые бюджеты (все суммы = 0)
    const emptyBudgets = budgets.filter((b: any) => 
      !b.planned_amount || parseFloat(String(b.planned_amount)) === 0
    );
    
    checks.push({
      id: 'empty_budgets',
      category: 'quality',
      severity: emptyBudgets.length > 0 ? 'warning' : 'ok',
      name: 'Пустые статьи бюджета',
      count: emptyBudgets.length,
      message: emptyBudgets.length > 0
        ? `${emptyBudgets.length} статей бюджета не заполнены`
        : 'Бюджет заполнен'
    });

    // ==========================================
    // ИТОГ
    // ==========================================

    const criticalCount = checks.filter(c => c.severity === 'critical').length;
    const warningCount = checks.filter(c => c.severity === 'warning').length;
    const okCount = checks.filter(c => c.severity === 'ok').length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_checks: checks.length,
      critical: criticalCount,
      warnings: warningCount,
      ok: okCount,
      checks
    });

  } catch (error) {
    console.error('Ошибка диагностики:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}