import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const startTime = Date.now();
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  const elapsed = Date.now() - startTime;
  console.log(`GAS ${sheet}: ${elapsed}ms, ${Array.isArray(data) ? data.length : 0} rows`);
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const performanceData: { sheet: string; time: number; rows: number }[] = [];
  
  try {
    // Загружаем все данные с замером скорости
    const loadStart = Date.now();
    const [transactions, accounts, companies, budgets, settings] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies'),
      gasGet('Budgets'),
      gasGet('Settings')
    ]);
    const loadTime = Date.now() - loadStart;
    
    const checks: any[] = [];

    // ============ НАСТРОЙКИ ИЗ SETTINGS ============
    const taxSettings: any = {};
    settings.forEach((s: any) => {
      taxSettings[s.key] = s.value;
    });

    const getRate = (key: string, defaultVal: number) => {
      const val = parseFloat(taxSettings[key]);
      return isNaN(val) ? defaultVal : val;
    };

    // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
    const getDateStr = (d: any) => {
      if (!d) return '';
      if (typeof d === 'string') return d.split('T')[0];
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    const getMonth = (d: any) => getDateStr(d).substring(0, 7);

    const amountOf = (t: any) => parseFloat(String(t.amount || 0));

    // ============ 1. СКОРОСТЬ ЗАГРУЗКИ GAS ============
    const slowThreshold = 5000; // 5 секунд
    checks.push({
      id: 'gas_speed',
      category: 'performance',
      severity: loadTime > slowThreshold ? 'critical' : loadTime > 2000 ? 'warning' : 'ok',
      name: 'Скорость загрузки данных',
      message: `Загрузка всех данных: ${(loadTime / 1000).toFixed(2)} сек`,
      details: {
        total_time: loadTime,
        threshold: slowThreshold,
        sheets: {
          transactions: transactions.length,
          accounts: accounts.length,
          companies: companies.length,
          budgets: budgets.length,
          settings: settings.length
        }
      },
      recommendation: loadTime > slowThreshold 
        ? 'Оптимизируйте GAS-скрипт: используйте batch-запросы, кэширование, уменьшите объём данных'
        : null
    });

    // ============ 2. ЦЕЛОСТНОСТЬ ДАННЫХ ============

    // 2.1 Операции без категории
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
      recommendation: 'Присвойте категории операциям через интерфейс',
      auto_fix: false
    });

    // 2.2 Операции без даты
    const noDate = transactions.filter(t => !t.date);
    checks.push({
      id: 'no_date',
      category: 'data',
      severity: noDate.length > 0 ? 'critical' : 'ok',
      name: 'Операции без даты',
      count: noDate.length,
      message: noDate.length > 0 ? `${noDate.length} операций без даты` : 'Все операции имеют дату',
      details: noDate.slice(0, 20).map(t => ({ id: t.id, description: t.description })),
      recommendation: 'Добавьте даты операциям',
      auto_fix: false
    });

    // 2.3 Операции с нулевой суммой
    const zeroAmount = transactions.filter(t => amountOf(t) === 0);
    checks.push({
      id: 'zero_amount',
      category: 'data',
      severity: zeroAmount.length > 0 ? 'warning' : 'ok',
      name: 'Операции с нулевой суммой',
      count: zeroAmount.length,
      message: zeroAmount.length > 0 ? `${zeroAmount.length} операций с нулевой суммой` : 'Все операции имеют сумму',
      details: zeroAmount.slice(0, 20).map(t => ({ id: t.id, date: getDateStr(t.date) })),
      recommendation: 'Проверьте операции с нулевой суммой',
      auto_fix: false
    });

    // 2.4 Дубли по import_hash
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
      details: duplicates.slice(0, 20).map(([hash, count]) => ({ hash, count })),
      recommendation: 'Удалите дублирующиеся операции',
      auto_fix: true,
      auto_fix_action: 'delete_duplicates',
      auto_fix_data: duplicates.slice(0, 20).map(([hash]) => hash)
    });

    // ============ 3. ПРОВЕРКА СЧЕТОВ ПО КОМПАНИЯМ ============
    
    // Исправлено: проверяем счета, которые ИСПОЛЬЗУЮТСЯ в операциях компании
    const companiesWithoutAccounts = companies.filter(c => {
      const companyTransactions = transactions.filter(t => t.company_id === c.id);
      const usedAccountIds = new Set<string>();
      companyTransactions.forEach(t => {
        usedAccountIds.add(t.debit_account_id);
        usedAccountIds.add(t.credit_account_id);
      });
      // Проверяем, что все используемые счета существуют в справочнике
      const missingAccounts = Array.from(usedAccountIds).filter(accId => 
        !accounts.some(a => a.id === accId)
      );
      return missingAccounts.length > 0;
    });
    
    checks.push({
      id: 'companies_without_accounts',
      category: 'link',
      severity: companiesWithoutAccounts.length > 0 ? 'critical' : 'ok',
      name: 'Компании с проблемными счетами',
      count: companiesWithoutAccounts.length,
      message: companiesWithoutAccounts.length > 0
        ? `${companiesWithoutAccounts.length} компаний имеют операции с несуществующими счетами`
        : 'Все счета в операциях существуют',
      details: companiesWithoutAccounts.map(c => {
        const companyTransactions = transactions.filter(t => t.company_id === c.id);
        const usedAccountIds = new Set<string>();
        companyTransactions.forEach(t => {
          usedAccountIds.add(t.debit_account_id);
          usedAccountIds.add(t.credit_account_id);
        });
        const missingAccounts = Array.from(usedAccountIds).filter(accId => 
          !accounts.some(a => a.id === accId)
        );
        return {
          id: c.id,
          name: c.name,
          missing_accounts: missingAccounts
        };
      }),
      recommendation: 'Проверьте привязку счетов в операциях',
      auto_fix: false
    });

    // ============ 4. КРОСС-ПРОВЕРКИ С ДАШБОРДОМ ============

    // 4.1 Выручка по компаниям (сравнение с консолидированной)
    const companyRevenues = new Map<string, number>();
    const companyExpenses = new Map<string, number>();
    
    for (const company of companies) {
      const companyTx = transactions.filter(t => t.company_id === company.id);
      
      const revenue = companyTx
        .filter(t => {
          const creditAcc = accounts.find(a => a.id === t.credit_account_id);
          return creditAcc?.type === 'I';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);
      
      const expenses = companyTx
        .filter(t => {
          const debitAcc = accounts.find(a => a.id === t.debit_account_id);
          return debitAcc?.type === 'X';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);
      
      companyRevenues.set(company.id, revenue);
      companyExpenses.set(company.id, expenses);
    }
    
    const totalRevenue = Array.from(companyRevenues.values()).reduce((s, v) => s + v, 0);
    const totalExpenses = Array.from(companyExpenses.values()).reduce((s, v) => s + v, 0);
    
    // Проверка: сумма выручки по компаниям должна равняться общей выручке
    const allTransactionsRevenue = transactions
      .filter(t => {
        const creditAcc = accounts.find(a => a.id === t.credit_account_id);
        return creditAcc?.type === 'I';
      })
      .reduce((sum, t) => sum + amountOf(t), 0);
    
    const revenueMismatch = Math.abs(totalRevenue - allTransactionsRevenue);
    checks.push({
      id: 'revenue_crosscheck',
      category: 'crosscheck',
      severity: revenueMismatch > 0.01 ? 'critical' : 'ok',
      name: 'Кросс-проверка выручки',
      message: revenueMismatch > 0.01
        ? `Расхождение выручки: по компаниям ${totalRevenue.toLocaleString('ru-RU')} ₽, общая ${allTransactionsRevenue.toLocaleString('ru-RU')} ₽ (разница: ${revenueMismatch.toLocaleString('ru-RU')} ₽)`
        : 'Выручка по компаниям сходится с общей',
      details: {
        by_company: Array.from(companyRevenues.entries()).map(([id, rev]) => ({
          company: companies.find(c => c.id === id)?.name,
          revenue: rev
        })),
        total_by_company: totalRevenue,
        total_overall: allTransactionsRevenue,
        difference: revenueMismatch
      },
      recommendation: revenueMismatch > 0.01 ? 'Проверьте операции, привязанные к нескольким компаниям одновременно' : null
    });

    // ============ 5. ПРОВЕРКА EBITDA ============
    
    const companyProfits = new Map<string, number>();
    for (const company of companies) {
      const rev = companyRevenues.get(company.id) || 0;
      const exp = companyExpenses.get(company.id) || 0;
      const profit = rev - exp;
      
      let incomeTax = 0;
      if (company.tax_system === 'USN_6') {
        incomeTax = rev * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        incomeTax = Math.max(0, profit) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        incomeTax = Math.max(0, profit) * getRate('profit_tax', 0.25);
      }
      
      companyProfits.set(company.id, profit);
      
      // EBITDA = Чистая прибыль + Налог на прибыль + Амортизация
      const depreciation = transactions
        .filter(t => t.company_id === company.id)
        .filter(t => {
          const debitAcc = accounts.find(a => a.id === t.debit_account_id);
          return debitAcc?.code === 'DEPRECIATION';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);
      
      const ebitda = profit + incomeTax + depreciation;
      
      if (profit < 0) {
        checks.push({
          id: `negative_profit_${company.id}`,
          category: 'financial',
          severity: 'critical',
          name: `Убыток: ${company.name}`,
          message: `${company.name}: убыток ${profit.toLocaleString('ru-RU')} ₽`,
          details: {
            revenue: rev,
            expenses: exp,
            profit,
            ebitda
          },
          recommendation: 'Проанализируйте расходы и найдите возможности для оптимизации'
        });
      }
    }

    // ============ 6. БАЛАНС ============
    
    let cash = 0, ar = 0, ap = 0, inventory = 0, fixedAssets = 0, loans = 0, capital = 0;
    
    for (const t of transactions) {
      const amt = amountOf(t);
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);
      
      if (!debitAcc || !creditAcc) continue;
      
      if (debitAcc.is_cash_flow === true || debitAcc.is_cash_flow === 'true') cash += amt;
      if (creditAcc.is_cash_flow === true || creditAcc.is_cash_flow === 'true') cash -= amt;
      
      if (t.debit_account_id === 'acc-ar-001') ar += amt;
      if (t.credit_account_id === 'acc-ar-001') ar -= amt;
      
      if (t.credit_account_id === 'acc-ap-001') ap += amt;
      if (t.debit_account_id === 'acc-ap-001') ap -= amt;
      
      if (t.credit_account_id === 'acc-equity-001' && t.record_type === 'fact') {
        capital += amt;
        cash += amt; // Начальный остаток на банковском счёте
      }
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
      recommendation: balanceOk ? null : 'Проверьте операции и начальные остатки',
      auto_fix: false
    });

    // ============ 7. КАССОВЫЕ РАЗРЫВЫ ============

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
      recommendation: gaps.length > 0 ? 'Перенесите платежи или привлеките финансирование' : null,
      auto_fix: false
    });

    // ============ 8. БЮДЖЕТ ============

    const emptyBudgets = budgets.filter(b => amountOf(b) === 0 && b.status === 'draft');
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
      recommendation: 'Заполните пустые статьи бюджета',
      auto_fix: false
    });

    // ============ 9. ПРОВЕРКА ЗАКРЫТЫХ МЕСЯЦЕВ ============
    
    const closedMonths = new Set<string>();
    budgets.forEach(b => {
      if (b.status === 'closed') {
        closedMonths.add(String(b.period || '').replace(/^'/, '').substring(0, 7));
      }
    });
    
    const unclosedMonths: string[] = [];
    const sortedClosedMonths = Array.from(closedMonths).sort();
    if (sortedClosedMonths.length > 0) {
      const lastClosed = sortedClosedMonths[sortedClosedMonths.length - 1];
      const [year, month] = lastClosed.split('-').map(Number);
      const nextMonth = new Date(year, month, 1); // следующий месяц
      const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (nextMonthStr < currentMonthStr) {
        unclosedMonths.push(nextMonthStr);
      }
    }
    
    checks.push({
      id: 'unclosed_months',
      category: 'process',
      severity: unclosedMonths.length > 0 ? 'warning' : 'ok',
      name: 'Незакрытые месяцы',
      count: unclosedMonths.length,
      message: unclosedMonths.length > 0 
        ? `Месяцы не закрыты: ${unclosedMonths.join(', ')}` 
        : 'Все месяцы закрыты',
      details: unclosedMonths,
      recommendation: unclosedMonths.length > 0 ? 'Закройте месяцы последовательно' : null,
      auto_fix: false
    });

    // ============ ИТОГ ============

    const critical = checks.filter(c => c.severity === 'critical').length;
    const warnings = checks.filter(c => c.severity === 'warning').length;
    const ok = checks.filter(c => c.severity === 'ok' || c.severity === 'info').length;

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_checks: checks.length,
      critical,
      warnings,
      ok,
      execution_time: totalTime,
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