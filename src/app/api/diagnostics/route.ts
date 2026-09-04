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
    const [transactions, accounts, companies, budgets, settings] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies'),
      gasGet('Budgets'),
      gasGet('Settings')
    ]);

    const checks: any[] = [];

    // ============ НАСТРОЙКИ ИЗ SETTINGS ============
    const taxSettings: any = {};
    settings.forEach((s: any) => {
      taxSettings[s.key] = parseFloat(s.value || '0');
    });

    const getRate = (key: string, defaultVal: number) => taxSettings[key] || defaultVal;

    // ============ ВСПОМОГАТЕЛЬНЫЕ ============
    const getDateStr = (d: any) => {
      if (!d) return '';
      if (typeof d === 'string') return d.split('T')[0];
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    const getMonth = (d: any) => getDateStr(d).substring(0, 7);

    const amountOf = (t: any) => parseFloat(String(t.amount || 0));

    // ============ 1. ПРОВЕРКА ДАННЫХ ============

    // 1.1 Операции без категории
    const unclassified = transactions.filter(t =>
      !t.debit_account_id || !t.credit_account_id ||
      t.debit_account_id === 'acc-unclassified' ||
      t.credit_account_id === 'acc-unclassified'
    );
    checks.push({
      id: 'unclassified',
      category: 'data',
      severity: unclassified.length > 0 ? 'critical' : 'ok',
      name: 'Операции без категории',
      count: unclassified.length,
      message: unclassified.length > 0
        ? `${unclassified.length} операций требуют категоризации`
        : 'Все операции категоризированы',
      details: unclassified.slice(0, 20).map(t => ({
        id: t.id,
        date: getDateStr(t.date),
        amount: amountOf(t),
        description: t.description || '(нет описания)'
      })),
      recommendation: 'Присвойте категории операциям через интерфейс'
    });

    // 1.2 Операции без даты
    const noDate = transactions.filter(t => !t.date);
    checks.push({
      id: 'no_date',
      category: 'data',
      severity: noDate.length > 0 ? 'critical' : 'ok',
      name: 'Операции без даты',
      count: noDate.length,
      message: noDate.length > 0 ? `${noDate.length} операций без даты` : 'Все операции имеют дату',
      details: noDate.slice(0, 20).map(t => ({ id: t.id, description: t.description })),
      recommendation: 'Добавьте даты операциям'
    });

    // 1.3 Операции с нулевой суммой
    const zeroAmount = transactions.filter(t => amountOf(t) === 0);
    checks.push({
      id: 'zero_amount',
      category: 'data',
      severity: zeroAmount.length > 0 ? 'warning' : 'ok',
      name: 'Операции с нулевой суммой',
      count: zeroAmount.length,
      message: zeroAmount.length > 0 ? `${zeroAmount.length} операций с нулевой суммой` : 'Все операции имеют сумму',
      details: zeroAmount.slice(0, 20).map(t => ({ id: t.id, date: getDateStr(t.date) })),
      recommendation: 'Проверьте операции с нулевой суммой'
    });

    // 1.4 Дубли по import_hash
    const hashCounts = new Map<string, number>();
    transactions.forEach(t => {
      if (t.import_hash) {
        hashCounts.set(t.import_hash, (hashCounts.get(t.import_hash) || 0) + 1);
      }
    });
    const duplicates = Array.from(hashCounts.entries()).filter(([, c]) => c > 1);
    checks.push({
      id: 'duplicates',
      category: 'data',
      severity: duplicates.length > 0 ? 'critical' : 'ok',
      name: 'Дублирующиеся операции',
      count: duplicates.length,
      message: duplicates.length > 0 ? `${duplicates.length} дублей` : 'Дублей нет',
      details: duplicates.map(([hash, count]) => ({ hash, count })),
      recommendation: 'Удалите дублирующиеся операции'
    });

    // ============ 2. РАСЧЁТЫ ПО КОМПАНИЯМ ============

    for (const company of companies) {
      const companyTx = transactions.filter(t => t.company_id === company.id);
      
      // Выручка
      const revenue = companyTx
        .filter(t => {
          const creditAcc = accounts.find(a => a.id === t.credit_account_id);
          return creditAcc?.type === 'I';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);
      
      // Расходы
      const expenses = companyTx
        .filter(t => {
          const debitAcc = accounts.find(a => a.id === t.debit_account_id);
          return debitAcc?.type === 'X';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);

      // УСН
      let expectedTax = 0;
      if (company.tax_system === 'USN_6') {
        expectedTax = revenue * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        expectedTax = Math.max(0, revenue - expenses) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        expectedTax = Math.max(0, revenue - expenses) * getRate('profit_tax', 0.25);
      }

      // Взносы
      const payroll = company.monthly_payroll || 0;
      const annualPayroll = payroll * 12;
      const insuranceRate = getRate('insurance_base_rate', 0.30);
      const insuranceLimit = getRate('insurance_limit', 2979000);
      let expectedInsurance = 0;
      if (annualPayroll <= insuranceLimit) {
        expectedInsurance = annualPayroll * insuranceRate;
      } else {
        expectedInsurance = insuranceLimit * insuranceRate + 
          (annualPayroll - insuranceLimit) * getRate('insurance_reduced_rate', 0.151);
      }

      // НДФЛ
      const ndflRate = getRate('ndfl_base_rate', 0.13);
      const ndflLimit = getRate('ndfl_limit', 5000000);
      let expectedNdfl = 0;
      if (annualPayroll <= ndflLimit) {
        expectedNdfl = annualPayroll * ndflRate;
      } else {
        expectedNdfl = ndflLimit * ndflRate + 
          (annualPayroll - ndflLimit) * getRate('ndfl_increased_rate', 0.15);
      }

      checks.push({
        id: `tax_${company.id}`,
        category: 'calculation',
        severity: 'info',
        name: `Налоги: ${company.name}`,
        message: `УСН: ${Math.round(expectedTax).toLocaleString('ru-RU')} ₽, Взносы: ${Math.round(expectedInsurance).toLocaleString('ru-RU')} ₽, НДФЛ: ${Math.round(expectedNdfl).toLocaleString('ru-RU')} ₽`,
        details: {
          revenue,
          expenses,
          expected_tax: expectedTax,
          expected_insurance: expectedInsurance,
          expected_ndfl: expectedNdfl
        }
      });
    }

    // ============ 3. БАЛАНС ============
    
    let cash = 0, ar = 0, ap = 0, inventory = 0, fixedAssets = 0, loans = 0, capital = 0;
    
    for (const t of transactions) {
      const amt = amountOf(t);
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);
      
      if (!debitAcc || !creditAcc) continue;
      
      if (debitAcc.is_cash_flow === true) cash += amt;
      if (creditAcc.is_cash_flow === true) cash -= amt;
      
      if (t.debit_account_id === 'acc-ar-001') ar += amt;
      if (t.credit_account_id === 'acc-ar-001') ar -= amt;
      
      if (t.credit_account_id === 'acc-ap-001') ap += amt;
      if (t.debit_account_id === 'acc-ap-001') ap -= amt;
      
      if (t.credit_account_id === 'acc-equity-001') capital += amt;
    }
    
    const assets = cash + ar + inventory + fixedAssets;
    const liabilities = ap + loans;
    const equity = assets - liabilities;
    
    const balanceOk = Math.abs(assets - liabilities - equity) < 0.01;
    
    checks.push({
      id: 'balance',
      category: 'calculation',
      severity: balanceOk ? 'ok' : 'critical',
      name: 'Баланс: Активы = Пассивы + Капитал',
      message: balanceOk ? 'Баланс сходится' : 'Баланс НЕ сходится',
      expected: assets,
      actual: liabilities + equity,
      difference: Math.abs(assets - liabilities - equity),
      details: { cash, ar, ap, assets, liabilities, equity },
      recommendation: balanceOk ? null : 'Проверьте операции и начальные остатки'
    });

    // ============ 4. КАССОВЫЕ РАЗРЫВЫ ============

    const today = new Date().toISOString().split('T')[0];
    let projectedCash = cash;
    const gaps: any[] = [];
    
    const futureTx = transactions
      .filter(t => getDateStr(t.date) >= today)
      .sort((a, b) => getDateStr(a.date).localeCompare(getDateStr(b.date)));
    
    for (const t of futureTx) {
      if (t.type === 'income') projectedCash += amountOf(t);
      if (t.type === 'expense') projectedCash -= amountOf(t);
      
      if (projectedCash < 0) {
        gaps.push({
          date: getDateStr(t.date),
          deficit: Math.abs(projectedCash)
        });
      }
    }
    
    checks.push({
      id: 'cash_gaps',
      category: 'risk',
      severity: gaps.length > 0 ? 'critical' : 'ok',
      name: 'Кассовые разрывы',
      count: gaps.length,
      message: gaps.length > 0 ? `${gaps.length} кассовых разрывов` : 'Кассовых разрывов нет',
      details: gaps.slice(0, 10),
      recommendation: gaps.length > 0 ? 'Перенесите платежи или привлеките финансирование' : null
    });

    // ============ 5. БЮДЖЕТ ============

    const emptyBudgets = budgets.filter(b => amountOf(b) === 0);
    checks.push({
      id: 'empty_budgets',
      category: 'quality',
      severity: emptyBudgets.length > 0 ? 'warning' : 'ok',
      name: 'Пустые статьи бюджета',
      count: emptyBudgets.length,
      message: emptyBudgets.length > 0 ? `${emptyBudgets.length} статей не заполнены` : 'Бюджет заполнен',
      details: emptyBudgets.slice(0, 20).map(b => ({
        period: String(b.period || '').replace(/^'/, '').substring(0, 7),
        category: b.category_id
      })),
      recommendation: 'Заполните пустые статьи бюджета'
    });

    // ============ 6. СВЯЗИ ============

    const companiesWithoutAccounts = companies.filter(c => 
      !accounts.some(a => a.company_id === c.id)
    );
    checks.push({
      id: 'companies_without_accounts',
      category: 'link',
      severity: companiesWithoutAccounts.length > 0 ? 'warning' : 'ok',
      name: 'Компании без счетов',
      count: companiesWithoutAccounts.length,
      message: companiesWithoutAccounts.length > 0
        ? `${companiesWithoutAccounts.length} компаний без счетов`
        : 'Все компании имеют счета',
      details: companiesWithoutAccounts.map(c => ({ id: c.id, name: c.name })),
      recommendation: 'Привяжите счета к компаниям'
    });

    // ============ ИТОГ ============

    const critical = checks.filter(c => c.severity === 'critical').length;
    const warnings = checks.filter(c => c.severity === 'warning').length;
    const ok = checks.filter(c => c.severity === 'ok' || c.severity === 'info').length;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_checks: checks.length,
      critical,
      warnings,
      ok,
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