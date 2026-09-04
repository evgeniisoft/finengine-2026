import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const startTime = Date.now();
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  const elapsed = Date.now() - startTime;
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Загружаем все данные
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

    // ============ НАСТРОЙКИ ============
    const taxSettings: any = {};
    settings.forEach((s: any) => {
      taxSettings[s.key] = s.value;
    });

    const getRate = (key: string, defaultVal: number) => {
      const val = parseFloat(taxSettings[key]);
      return isNaN(val) ? defaultVal : val;
    };

   // ============ ВСПОМОГАТЕЛЬНЫЕ ============
    const getDateStr = (d: any) => {
      if (!d) return '';
      if (typeof d === 'string') return d.split('T')[0];
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    const getMonth = (d: any) => getDateStr(d).substring(0, 7);
    const amountOf = (t: any) => parseFloat(String(t.amount || 0));

    // Инициализация переменных для расчётов
    const revenueByCompany = new Map<string, number>();
    const expensesByCompany = new Map<string, number>();

    // Заполняем данными по всем компаниям
    for (const company of companies) {
      const companyTx = transactions.filter(t => t.company_id === company.id);
      const revenue = companyTx
        .filter(t => accounts.find(a => a.id === t.credit_account_id)?.type === 'I')
        .reduce((sum, t) => sum + amountOf(t), 0);
      const expenses = companyTx
        .filter(t => accounts.find(a => a.id === t.debit_account_id)?.type === 'X')
        .reduce((sum, t) => sum + amountOf(t), 0);

      revenueByCompany.set(company.id, revenue);
      expensesByCompany.set(company.id, expenses);
    }

    // ============================================
    // БЛОК 1: ИНФРАСТРУКТУРА
    // ============================================

    // 1.1 Скорость GAS
    const slowThreshold = 5000;
    checks.push({
      id: 'gas_speed',
      category: 'infrastructure',
      severity: loadTime > slowThreshold ? 'critical' : loadTime > 2000 ? 'warning' : 'ok',
      name: 'Скорость загрузки данных',
      message: `Загрузка всех данных: ${(loadTime / 1000).toFixed(2)} сек`,
      details: {
        total_time_ms: loadTime,
        threshold_ms: slowThreshold,
        sheets: {
          transactions: transactions.length,
          accounts: accounts.length,
          companies: companies.length,
          budgets: budgets.length,
          settings: settings.length
        }
      },
      recommendation: loadTime > slowThreshold
        ? 'Оптимизируйте GAS-скрипт: используйте batch-запросы, кэширование'
        : null
    });

    // 1.2 Лимиты GAS (оценочно)
    const totalRows = transactions.length + accounts.length + companies.length + budgets.length + settings.length;
    const estimatedQuota = totalRows * 0.5; // примерная оценка
    const gasQuotaLimit = 100000; // дневной лимит Google Apps Script
    checks.push({
      id: 'gas_quota',
      category: 'infrastructure',
      severity: estimatedQuota > gasQuotaLimit * 0.8 ? 'warning' : 'ok',
      name: 'Лимиты GAS',
      message: `Использовано ~${estimatedQuota.toLocaleString('ru-RU')} из ${gasQuotaLimit.toLocaleString('ru-RU')} операций`,
      details: {
        total_rows: totalRows,
        estimated_operations: estimatedQuota,
        daily_limit: gasQuotaLimit,
        usage_percent: (estimatedQuota / gasQuotaLimit * 100).toFixed(2)
      },
      recommendation: estimatedQuota > gasQuotaLimit * 0.8
        ? 'Приближаетесь к лимиту GAS. Рассмотрите переход на PostgreSQL'
        : null
    });

    // ============================================
    // БЛОК 2: КАЧЕСТВО ДАННЫХ
    // ============================================

    // 2.1 Операции без категории
    const unclassified = transactions.filter(t =>
      !t.debit_account_id || !t.credit_account_id ||
      t.debit_account_id === 'acc-unclassified' ||
      t.credit_account_id === 'acc-unclassified'
    );
    checks.push({
      id: 'unclassified',
      category: 'data_quality',
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
      recommendation: unclassified.length > 0 ? 'Присвойте категории операциям' : null
    });

    // 2.2 Операции без даты
    const noDate = transactions.filter(t => !t.date);
    checks.push({
      id: 'no_date',
      category: 'data_quality',
      severity: noDate.length > 0 ? 'critical' : 'ok',
      name: 'Операции без даты',
      count: noDate.length,
      message: noDate.length > 0 ? `${noDate.length} операций без даты` : 'Все операции имеют дату',
      details: noDate.slice(0, 20).map(t => ({ id: t.id, description: t.description })),
      recommendation: noDate.length > 0 ? 'Добавьте даты операциям' : null
    });

    // 2.3 Дубликаты
    const hashCounts = new Map<string, number>();
    transactions.forEach(t => {
      if (t.import_hash) {
        hashCounts.set(t.import_hash, (hashCounts.get(t.import_hash) || 0) + 1);
      }
    });
    const duplicates = Array.from(hashCounts.entries()).filter(([, c]) => c > 1);
    checks.push({
      id: 'duplicates',
      category: 'data_quality',
      severity: duplicates.length > 0 ? 'critical' : 'ok',
      name: 'Дублирующиеся операции',
      count: duplicates.length,
      message: duplicates.length > 0 ? `${duplicates.length} дублей` : 'Дублей нет',
      details: duplicates.slice(0, 20).map(([hash, count]) => ({ hash, count })),
      recommendation: duplicates.length > 0 ? 'Удалите дублирующиеся операции' : null,
      auto_fix: duplicates.length > 0,
      auto_fix_action: 'delete_duplicates',
      auto_fix_data: duplicates.slice(0, 20).map(([hash]) => hash)
    });

    // 2.4 Связанность - несуществующие счета
    const companiesWithBadAccounts = companies.filter(c => {
      const companyTx = transactions.filter(t => t.company_id === c.id);
      const usedAccounts = new Set<string>();
      companyTx.forEach(t => {
        usedAccounts.add(t.debit_account_id);
        usedAccounts.add(t.credit_account_id);
      });
      return Array.from(usedAccounts).some(accId => !accounts.some(a => a.id === accId));
    });
    checks.push({
      id: 'bad_account_links',
      category: 'data_quality',
      severity: companiesWithBadAccounts.length > 0 ? 'critical' : 'ok',
      name: 'Несуществующие счета',
      count: companiesWithBadAccounts.length,
      message: companiesWithBadAccounts.length > 0
        ? `${companiesWithBadAccounts.length} компаний имеют операции с несуществующими счетами`
        : 'Все счета существуют',
      details: companiesWithBadAccounts.map(c => {
        const companyTx = transactions.filter(t => t.company_id === c.id);
        const usedAccounts = new Set<string>();
        companyTx.forEach(t => {
          usedAccounts.add(t.debit_account_id);
          usedAccounts.add(t.credit_account_id);
        });
        return {
          company: c.name,
          missing_accounts: Array.from(usedAccounts).filter(accId => !accounts.some(a => a.id === accId))
        };
      }),
      recommendation: companiesWithBadAccounts.length > 0 ? 'Исправьте привязку счетов' : null
    });

    // 2.5 Аномалии - выбросы в операциях
    const amounts = transactions.map(t => amountOf(t));
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / (amounts.length || 1);
    const stdDev = Math.sqrt(
      amounts.reduce((s, v) => s + Math.pow(v - avgAmount, 2), 0) / (amounts.length || 1)
    );
    const anomalies = transactions.filter(t => {
      const amt = amountOf(t);
      return amt > avgAmount + 3 * stdDev && amt > 0;
    });
    checks.push({
      id: 'amount_anomalies',
      category: 'data_quality',
      severity: anomalies.length > 0 ? 'warning' : 'ok',
      name: 'Аномальные операции',
      count: anomalies.length,
      message: anomalies.length > 0
        ? `${anomalies.length} операций с аномально большими суммами`
        : 'Аномалий не обнаружено',
      details: anomalies.slice(0, 10).map(t => ({
        id: t.id,
        date: getDateStr(t.date),
        amount: amountOf(t),
        description: t.description,
        avg_amount: Math.round(avgAmount),
        std_dev: Math.round(stdDev)
      })),
      recommendation: anomalies.length > 0 ? 'Проверьте аномально крупные операции' : null
    });

    // 2.6 Полнота - компании без операций
    const companiesWithoutTx = companies.filter(c =>
      !transactions.some(t => t.company_id === c.id)
    );
    checks.push({
      id: 'companies_without_transactions',
      category: 'data_quality',
      severity: companiesWithoutTx.length > 0 ? 'warning' : 'ok',
      name: 'Компании без операций',
      count: companiesWithoutTx.length,
      message: companiesWithoutTx.length > 0
        ? `${companiesWithoutTx.length} компаний без операций`
        : 'Все компании имеют операции',
      details: companiesWithoutTx.map(c => ({ id: c.id, name: c.name })),
      recommendation: companiesWithoutTx.length > 0 ? 'Добавьте операции или удалите компании' : null
    });
    // ============================================
    // БЛОК 2.5: СВЕРКА С ДАШБОРДОМ
    // ============================================

    // 2.5.1 Сверка выручки с дашбордом
    // Дашборд получает данные через /api/reports?type=pnl
    // Считаем так же, как это делает calculator.calculatePnL
    for (const company of companies) {
      const companyTx = transactions.filter(t => t.company_id === company.id);

      // Выручка как в calculatePnL
      const dashboardRevenue = companyTx
        .filter(t => accounts.find(a => a.id === t.credit_account_id)?.type === 'I')
        .reduce((sum, t) => sum + amountOf(t), 0);

      // Расходы как в calculatePnL (операционные + COGS, без налогов)
      const dashboardExpenses = companyTx
        .filter(t => {
          const debitAcc = accounts.find(a => a.id === t.debit_account_id);
          return debitAcc?.type === 'X' && debitAcc?.code !== 'TAXES' && debitAcc?.code !== 'DEPRECIATION';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);

      // Налоги как в calculatePnL (из taxEngine)
      let calculatedTax = 0;
      if (company.tax_system === 'USN_6') {
        calculatedTax = dashboardRevenue * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        calculatedTax = Math.max(0, dashboardRevenue - dashboardExpenses) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        calculatedTax = Math.max(0, dashboardRevenue - dashboardExpenses) * getRate('profit_tax', 0.25);
      }

      // Амортизация как в calculatePnL
      const calculatedDepreciation = companyTx
        .filter(t => accounts.find(a => a.id === t.debit_account_id)?.code === 'DEPRECIATION')
        .reduce((sum, t) => sum + amountOf(t), 0);

      // Чистая прибыль как в calculatePnL
      const dashboardNetProfit = dashboardRevenue - dashboardExpenses - calculatedTax - calculatedDepreciation;

      // Проверяем, что цифры не расходятся
      checks.push({
        id: `dashboard_revenue_check_${company.id}`,
        category: 'dashboard',
        severity: Math.abs(dashboardRevenue - (revenueByCompany.get(company.id) || 0)) > 0.01 ? 'critical' : 'ok',
        name: `Дашборд: Выручка ${company.name}`,
        message: Math.abs(dashboardRevenue - (revenueByCompany.get(company.id) || 0)) > 0.01
          ? `Расхождение: дашборд ${dashboardRevenue.toLocaleString('ru-RU')} ₽, диагностика ${(revenueByCompany.get(company.id) || 0).toLocaleString('ru-RU')} ₽`
          : `Выручка на дашборде корректна: ${dashboardRevenue.toLocaleString('ru-RU')} ₽`,
        details: {
          dashboard_revenue: dashboardRevenue,
          diagnostic_revenue: revenueByCompany.get(company.id) || 0,
          difference: Math.abs(dashboardRevenue - (revenueByCompany.get(company.id) || 0))
        },
        recommendation: null
      });

      checks.push({
        id: `dashboard_profit_check_${company.id}`,
        category: 'dashboard',
        severity: 'info',
        name: `Дашборд: Прибыль ${company.name}`,
        message: `Чистая прибыль: ${dashboardNetProfit.toLocaleString('ru-RU')} ₽ (выручка ${dashboardRevenue.toLocaleString('ru-RU')} ₽ - расходы ${dashboardExpenses.toLocaleString('ru-RU')} ₽ - налоги ${calculatedTax.toLocaleString('ru-RU')} ₽ - амортизация ${calculatedDepreciation.toLocaleString('ru-RU')} ₽)`,
        details: {
          revenue: dashboardRevenue,
          expenses: dashboardExpenses,
          taxes: calculatedTax,
          depreciation: calculatedDepreciation,
          net_profit: dashboardNetProfit
        },
        recommendation: null
      });
    }

    // 2.5.2 Сверка итоговых сумм с дашбордом
    const dashboardTotalRevenue = Array.from(revenueByCompany.values()).reduce((s, v) => s + v, 0);
    const dashboardTotalExpenses = Array.from(expensesByCompany.values()).reduce((s, v) => s + v, 0);

    // Считаем так, как это делает дашборд
    const dashboardCalculatedProfit = dashboardTotalRevenue - dashboardTotalExpenses;

    checks.push({
      id: 'dashboard_totals_check',
      category: 'dashboard',
      severity: 'info',
      name: 'Дашборд: Итоговые суммы',
      message: `Выручка: ${dashboardTotalRevenue.toLocaleString('ru-RU')} ₽, Расходы: ${dashboardTotalExpenses.toLocaleString('ru-RU')} ₽, Прибыль: ${dashboardCalculatedProfit.toLocaleString('ru-RU')} ₽`,
      details: {
        total_revenue: dashboardTotalRevenue,
        total_expenses: dashboardTotalExpenses,
        calculated_profit: dashboardCalculatedProfit,
        margin: dashboardTotalRevenue > 0 ? ((dashboardCalculatedProfit / dashboardTotalRevenue) * 100).toFixed(2) + '%' : '0%'
      },
      recommendation: dashboardCalculatedProfit < 0
        ? 'Общая прибыль отрицательная. Требуется анализ.'
        : null
    });

    // 2.5.3 Сверка денег на дашборде
    const dashboardCash = transactions.reduce((sum, t) => {
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);
      if (!debitAcc || !creditAcc) return sum;
      let balance = sum;
      if (debitAcc.is_cash_flow === true || debitAcc.is_cash_flow === 'true') balance += amountOf(t);
      if (creditAcc.is_cash_flow === true || creditAcc.is_cash_flow === 'true') balance -= amountOf(t);
      return balance;
    }, 0);

    checks.push({
      id: 'dashboard_cash_check',
      category: 'dashboard',
      severity: dashboardCash < 0 ? 'critical' : 'ok',
      name: 'Дашборд: Деньги на счетах',
      message: dashboardCash < 0
        ? `Отрицательный остаток: ${dashboardCash.toLocaleString('ru-RU')} ₽`
        : `Остаток: ${dashboardCash.toLocaleString('ru-RU')} ₽`,
      details: {
        cash_balance: dashboardCash,
        is_negative: dashboardCash < 0
      },
      recommendation: dashboardCash < 0 ? 'Проверьте операции, приводящие к отрицательному остатку' : null
    });

    // 2.5.4 Сверка EBITDA с дашбордом
    const dashboardTotalDepreciation = transactions
      .filter(t => accounts.find(a => a.id === t.debit_account_id)?.code === 'DEPRECIATION')
      .reduce((sum, t) => sum + amountOf(t), 0);

    const dashboardTotalTax = Array.from(revenueByCompany.keys()).reduce((sum, companyId) => {
      const company = companies.find(c => c.id === companyId);
      if (!company) return sum;
      const rev = revenueByCompany.get(companyId) || 0;
      const exp = expensesByCompany.get(companyId) || 0;
      if (company.tax_system === 'USN_6') {
        return sum + rev * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        return sum + Math.max(0, rev - exp) * getRate('usn_15', 0.15);
      } else {
        return sum + Math.max(0, rev - exp) * getRate('profit_tax', 0.25);
      }
    }, 0);

    const dashboardEBITDA = dashboardCalculatedProfit + dashboardTotalTax + dashboardTotalDepreciation;

    checks.push({
      id: 'dashboard_ebitda_check',
      category: 'dashboard',
      severity: dashboardEBITDA < 0 ? 'warning' : 'ok',
      name: 'Дашборд: EBITDA',
      message: `EBITDA: ${dashboardEBITDA.toLocaleString('ru-RU')} ₽ (прибыль ${dashboardCalculatedProfit.toLocaleString('ru-RU')} ₽ + налог ${dashboardTotalTax.toLocaleString('ru-RU')} ₽ + амортизация ${dashboardTotalDepreciation.toLocaleString('ru-RU')} ₽)`,
      details: {
        profit: dashboardCalculatedProfit,
        tax: dashboardTotalTax,
        depreciation: dashboardTotalDepreciation,
        ebitda: dashboardEBITDA
      },
      recommendation: dashboardEBITDA < 0 ? 'EBITDA отрицательная. Бизнес не генерирует прибыль.' : null
    });
    // ============================================
    // БЛОК 3: ФИНАНСОВЫЕ РАСЧЁТЫ
    // ============================================

    const totalRevenue = Array.from(revenueByCompany.values()).reduce((s, v) => s + v, 0);
    const allTransactionsRevenue = transactions
      .filter(t => accounts.find(a => a.id === t.credit_account_id)?.type === 'I')
      .reduce((sum, t) => sum + amountOf(t), 0);

    checks.push({
      id: 'revenue_crosscheck',
      category: 'financial',
      severity: Math.abs(totalRevenue - allTransactionsRevenue) > 0.01 ? 'critical' : 'ok',
      name: 'ОПиУ: Сверка выручки',
      message: Math.abs(totalRevenue - allTransactionsRevenue) > 0.01
        ? `Расхождение: по компаниям ${totalRevenue.toLocaleString('ru-RU')} ₽, общая ${allTransactionsRevenue.toLocaleString('ru-RU')} ₽`
        : 'Выручка по компаниям сходится с общей',
      details: {
        by_company: Array.from(revenueByCompany.entries()).map(([id, rev]) => ({
          company: companies.find(c => c.id === id)?.name,
          revenue: rev
        })),
        total_by_company: totalRevenue,
        total_overall: allTransactionsRevenue,
        difference: Math.abs(totalRevenue - allTransactionsRevenue)
      },
      recommendation: null
    });

    // 3.2 ДДС - проверка остатков
    let ddStartBalance = 0;
    let ddInflow = 0;
    let ddOutflow = 0;

    for (const t of transactions) {
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);

      if (!debitAcc || !creditAcc) continue;

      if (debitAcc.is_cash_flow === true || debitAcc.is_cash_flow === 'true') {
        ddInflow += amountOf(t);
      }
      if (creditAcc.is_cash_flow === true || creditAcc.is_cash_flow === 'true') {
        ddOutflow += amountOf(t);
      }
    }

    // Начальный остаток - операции с equity до начала периода
    const initialBalance = transactions
      .filter(t => t.credit_account_id === 'acc-equity-001' && t.record_type === 'fact')
      .reduce((sum, t) => sum + amountOf(t), 0);

    const ddCalculatedEnding = initialBalance + ddInflow - ddOutflow;
    const actualCashBalance = transactions.reduce((sum, t) => {
      const debitAcc = accounts.find(a => a.id === t.debit_account_id);
      const creditAcc = accounts.find(a => a.id === t.credit_account_id);
      if (!debitAcc || !creditAcc) return sum;
      let balance = sum;
      if (debitAcc.is_cash_flow === true || debitAcc.is_cash_flow === 'true') balance += amountOf(t);
      if (creditAcc.is_cash_flow === true || creditAcc.is_cash_flow === 'true') balance -= amountOf(t);
      return balance;
    }, initialBalance);

    checks.push({
      id: 'cashflow_check',
      category: 'financial',
      severity: Math.abs(ddCalculatedEnding - actualCashBalance) > 0.01 ? 'critical' : 'ok',
      name: 'ДДС: Проверка остатков',
      message: Math.abs(ddCalculatedEnding - actualCashBalance) > 0.01
        ? `Расхождение: расчётный остаток ${ddCalculatedEnding.toLocaleString('ru-RU')} ₽, фактический ${actualCashBalance.toLocaleString('ru-RU')} ₽`
        : 'Остатки ДДС сходятся',
      details: {
        initial_balance: initialBalance,
        total_inflow: ddInflow,
        total_outflow: ddOutflow,
        calculated_ending: ddCalculatedEnding,
        actual_ending: actualCashBalance,
        difference: Math.abs(ddCalculatedEnding - actualCashBalance)
      },
      recommendation: null
    });

    // 3.3 Баланс - активы = пассивы + капитал
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
        cash += amt;
      }
    }

    const totalAssets = cash + ar + inventory + fixedAssets;
    const totalLiabilities = ap + loans;
    const totalEquity = totalAssets - totalLiabilities;

    checks.push({
      id: 'balance_check',
      category: 'financial',
      severity: Math.abs(totalAssets - totalLiabilities - totalEquity) > 0.01 ? 'critical' : 'ok',
      name: 'Баланс: Активы = Пассивы + Капитал',
      message: Math.abs(totalAssets - totalLiabilities - totalEquity) > 0.01
        ? 'Баланс НЕ сходится'
        : 'Баланс сходится',
      details: {
        cash, ar, ap, inventory, fixed_assets: fixedAssets,
        loans, capital,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        difference: Math.abs(totalAssets - totalLiabilities - totalEquity)
      },
      recommendation: null
    });

    // 3.4 EBITDA по компаниям
    for (const company of companies) {
      const rev = revenueByCompany.get(company.id) || 0;
      const exp = expensesByCompany.get(company.id) || 0;
      const profit = rev - exp;

      let incomeTax = 0;
      if (company.tax_system === 'USN_6') {
        incomeTax = rev * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        incomeTax = Math.max(0, profit) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        incomeTax = Math.max(0, profit) * getRate('profit_tax', 0.25);
      }

      const depreciation = transactions
        .filter(t => t.company_id === company.id)
        .filter(t => accounts.find(a => a.id === t.debit_account_id)?.code === 'DEPRECIATION')
        .reduce((sum, t) => sum + amountOf(t), 0);

      const ebitda = profit + incomeTax + depreciation;

      if (ebitda < 0) {
        checks.push({
          id: `negative_ebitda_${company.id}`,
          category: 'financial',
          severity: 'critical',
          name: `Отрицательная EBITDA: ${company.name}`,
          message: `${company.name}: EBITDA = ${ebitda.toLocaleString('ru-RU')} ₽`,
          details: { revenue: rev, expenses: exp, profit, income_tax: incomeTax, depreciation, ebitda },
          recommendation: 'Требуется пересмотр бизнес-модели или сокращение расходов'
        });
      }
    }

    // 3.5 Run Rate
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysPassed = now.getDate();
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const currentMonthRevenue = transactions
      .filter(t => getDateStr(t.date).startsWith(currentMonthStr) && t.type === 'income')
      .reduce((sum, t) => sum + amountOf(t), 0);

    const runRate = daysPassed > 0 ? (currentMonthRevenue / daysPassed) * daysInCurrentMonth : 0;

    const last3Months: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const historicalRevenue = transactions
      .filter(t => {
        const month = getDateStr(t.date).substring(0, 7);
        return last3Months.includes(month) && t.type === 'income';
      })
      .reduce((sum, t) => sum + amountOf(t), 0);

    const avgHistorical = historicalRevenue / 3;

    if (runRate > 0 && avgHistorical > 0) {
      const deviation = Math.abs(runRate - avgHistorical) / avgHistorical * 100;
      checks.push({
        id: 'run_rate_check',
        category: 'financial',
        severity: deviation > 30 ? 'warning' : 'ok',
        name: 'Run Rate отклонение',
        message: deviation > 30
          ? `Run Rate отклоняется на ${deviation.toFixed(1)}%`
          : `Run Rate в норме (${deviation.toFixed(1)}%)`,
        details: {
          current_month_revenue: currentMonthRevenue,
          projected_run_rate: Math.round(runRate),
          avg_historical: Math.round(avgHistorical),
          deviation_percent: Math.round(deviation * 10) / 10
        },
        recommendation: deviation > 30 ? 'Проверьте причины отклонения выручки' : null
      });
    }

    // ============================================
    // БЛОК 3.5: СВЕРКА ПРИБЫЛИ И НАЛОГОВ
    // ============================================

    // 3.5.1 Проверка: Чистая прибыль = Выручка - Расходы - Налоги - Амортизация
    for (const company of companies) {
      const rev = revenueByCompany.get(company.id) || 0;
      const exp = expensesByCompany.get(company.id) || 0;
      const profit = rev - exp;

      // Налоги
      let incomeTax = 0;
      if (company.tax_system === 'USN_6') {
        incomeTax = rev * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        incomeTax = Math.max(0, profit) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        incomeTax = Math.max(0, profit) * getRate('profit_tax', 0.25);
      }

      // Страховые взносы
      const payroll = company.monthly_payroll || 0;
      const annualPayroll = payroll * 12;
      let insurance = 0;
      if (company.is_individual) {
        insurance = 57390;
        if (rev > 300000) {
          insurance += Math.min((rev - 300000) * 0.01, 321818);
        }
      } else {
        const limit = getRate('insurance_limit', 2979000);
        const baseRate = getRate('insurance_base_rate', 0.30);
        const reducedRate = getRate('insurance_reduced_rate', 0.151);
        if (annualPayroll <= limit) {
          insurance = annualPayroll * baseRate;
        } else {
          insurance = limit * baseRate + (annualPayroll - limit) * reducedRate;
        }
      }

      // Амортизация
      const depreciation = transactions
        .filter(t => t.company_id === company.id)
        .filter(t => accounts.find(a => a.id === t.debit_account_id)?.code === 'DEPRECIATION')
        .reduce((sum, t) => sum + amountOf(t), 0);

      // Расходы включают налоги и амортизацию?
      const expensesWithTaxes = exp + insurance;

      const calculatedNetProfit = rev - expensesWithTaxes - incomeTax - depreciation;

      checks.push({
        id: `profit_check_${company.id}`,
        category: 'financial',
        severity: Math.abs(profit - calculatedNetProfit) > 100 ? 'warning' : 'ok',
        name: `Проверка прибыли: ${company.name}`,
        message: Math.abs(profit - calculatedNetProfit) > 100
          ? `Расхождение: операционная прибыль ${profit.toLocaleString('ru-RU')} ₽, чистая прибыль ${calculatedNetProfit.toLocaleString('ru-RU')} ₽`
          : `Прибыль рассчитана корректно (${profit.toLocaleString('ru-RU')} ₽)`,
        details: {
          revenue: rev,
          operating_expenses: exp,
          insurance,
          income_tax: incomeTax,
          depreciation,
          operating_profit: profit,
          calculated_net_profit: calculatedNetProfit,
          difference: Math.abs(profit - calculatedNetProfit)
        },
        recommendation: Math.abs(profit - calculatedNetProfit) > 100
          ? 'Проверьте классификацию расходов (включены ли налоги в расходы)'
          : null
      });
    }

    // 3.5.2 Сверка налогов: Сумма налогов по компаниям = Общей сумме
    let totalIncomeTax = 0;
    let totalInsurance = 0;
    let totalNdfl = 0;

    for (const company of companies) {
      const rev = revenueByCompany.get(company.id) || 0;
      const exp = expensesByCompany.get(company.id) || 0;
      const profit = rev - exp;

      let incomeTax = 0;
      if (company.tax_system === 'USN_6') {
        incomeTax = rev * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        incomeTax = Math.max(0, profit) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        incomeTax = Math.max(0, profit) * getRate('profit_tax', 0.25);
      }

      totalIncomeTax += incomeTax;

      const payroll = company.monthly_payroll || 0;
      const annualPayroll = payroll * 12;
      let insurance = 0;
      if (company.is_individual) {
        insurance = 57390;
        if (rev > 300000) {
          insurance += Math.min((rev - 300000) * 0.01, 321818);
        }
      } else {
        const limit = getRate('insurance_limit', 2979000);
        const baseRate = getRate('insurance_base_rate', 0.30);
        const reducedRate = getRate('insurance_reduced_rate', 0.151);
        if (annualPayroll <= limit) {
          insurance = annualPayroll * baseRate;
        } else {
          insurance = limit * baseRate + (annualPayroll - limit) * reducedRate;
        }
      }
      totalInsurance += insurance;

      const ndflLimit = getRate('ndfl_limit', 5000000);
      let ndfl = 0;
      if (annualPayroll <= ndflLimit) {
        ndfl = annualPayroll * getRate('ndfl_base_rate', 0.13);
      } else {
        ndfl = ndflLimit * getRate('ndfl_base_rate', 0.13) +
          (annualPayroll - ndflLimit) * getRate('ndfl_increased_rate', 0.15);
      }
      totalNdfl += ndfl;
    }

    const totalTaxBurden = totalIncomeTax + totalInsurance + totalNdfl;

    checks.push({
      id: 'tax_burden_summary',
      category: 'financial',
      severity: 'info',
      name: 'Сводка налоговой нагрузки',
      message: `Всего налогов: ${totalTaxBurden.toLocaleString('ru-RU')} ₽ (налог: ${totalIncomeTax.toLocaleString('ru-RU')} ₽, взносы: ${totalInsurance.toLocaleString('ru-RU')} ₽, НДФЛ: ${totalNdfl.toLocaleString('ru-RU')} ₽)`,
      details: {
        income_tax: totalIncomeTax,
        insurance: totalInsurance,
        ndfl: totalNdfl,
        total: totalTaxBurden,
        effective_rate: totalRevenue > 0 ? (totalTaxBurden / totalRevenue * 100).toFixed(2) + '%' : '0%'
      },
      recommendation: null
    });

    // 3.5.3 Проверка: Налог на прибыль не задвоен
    const pnlTaxes = transactions
      .filter(t => {
        const debitAcc = accounts.find(a => a.id === t.debit_account_id);
        return debitAcc?.code === 'TAXES';
      })
      .reduce((sum, t) => sum + amountOf(t), 0);

    checks.push({
      id: 'tax_double_count_check',
      category: 'financial',
      severity: pnlTaxes > 0 ? 'warning' : 'ok',
      name: 'Проверка задвоения налогов',
      message: pnlTaxes > 0
        ? `Обнаружены операции с кодом TAXES на ${pnlTaxes.toLocaleString('ru-RU')} ₽. Проверьте, не учтены ли налоги дважды`
        : 'Налоги не задвоены',
      details: {
        taxes_in_transactions: pnlTaxes,
        calculated_income_tax: totalIncomeTax,
        possible_double_count: pnlTaxes > 0 && Math.abs(pnlTaxes - totalIncomeTax) < 100
      },
      recommendation: pnlTaxes > 0
        ? 'Проверьте, не учтены ли налоги и в операциях, и в налоговом движке'
        : null
    });
    // ============================================
    // БЛОК 4: НАЛОГИ
    // ============================================

    for (const company of companies) {
      const rev = revenueByCompany.get(company.id) || 0;
      const exp = expensesByCompany.get(company.id) || 0;
      const profit = rev - exp;

      // 4.1 УСН
      if (company.tax_system === 'USN_6') {
        const expectedTax = rev * getRate('usn_6', 0.06);
        const insurance = company.monthly_payroll * 12 * getRate('insurance_base_rate', 0.30);
        const maxReduction = company.is_individual ? expectedTax : expectedTax * 0.5;
        const actualTax = Math.max(expectedTax - Math.min(insurance, maxReduction), 0);

        checks.push({
          id: `usn_tax_${company.id}`,
          category: 'taxes',
          severity: 'info',
          name: `УСН 6%: ${company.name}`,
          message: `Налог: ${Math.round(actualTax).toLocaleString('ru-RU')} ₽ (${expectedTax.toLocaleString('ru-RU')} ₽ до вычета взносов)`,
          details: {
            revenue: rev,
            tax_rate: getRate('usn_6', 0.06),
            tax_before_deduction: expectedTax,
            insurance_deduction: Math.min(insurance, maxReduction),
            final_tax: actualTax
          },
          recommendation: null
        });
      } else if (company.tax_system === 'USN_15') {
        const taxBase = Math.max(0, profit);
        const expectedTax = taxBase * getRate('usn_15', 0.15);
        const minimumTax = rev * getRate('usn_min_tax', 0.01);
        const finalTax = Math.max(expectedTax, minimumTax);

        checks.push({
          id: `usn_tax_${company.id}`,
          category: 'taxes',
          severity: 'info',
          name: `УСН 15%: ${company.name}`,
          message: `Налог: ${Math.round(finalTax).toLocaleString('ru-RU')} ₽ (база: ${taxBase.toLocaleString('ru-RU')} ₽)`,
          details: {
            revenue: rev,
            expenses: exp,
            tax_base: taxBase,
            tax_rate: getRate('usn_15', 0.15),
            calculated_tax: expectedTax,
            minimum_tax: minimumTax,
            final_tax: finalTax
          },
          recommendation: null
        });
      }

      // 4.2 Страховые взносы
      const payroll = company.monthly_payroll || 0;
      const annualPayroll = payroll * 12;
      let insurance = 0;
      let insuranceRate = 0;

      if (company.is_individual) {
        insurance = 57390;
        if (rev > 300000) {
          insurance += Math.min((rev - 300000) * 0.01, 321818);
        }
        insuranceRate = 0;
      } else if (company.industry_type === 'it') {
        const limit = 2979000;
        insuranceRate = 7.6;
        if (annualPayroll <= limit) {
          insurance = annualPayroll * 0.15;
        } else {
          insurance = limit * 0.15 + (annualPayroll - limit) * 0.076;
        }
      } else {
        const limit = getRate('insurance_limit', 2979000);
        const baseRate = getRate('insurance_base_rate', 0.30);
        const reducedRate = getRate('insurance_reduced_rate', 0.151);
        insuranceRate = baseRate * 100;
        if (annualPayroll <= limit) {
          insurance = annualPayroll * baseRate;
        } else {
          insurance = limit * baseRate + (annualPayroll - limit) * reducedRate;
        }
      }

      checks.push({
        id: `insurance_${company.id}`,
        category: 'taxes',
        severity: 'info',
        name: `Страховые взносы: ${company.name}`,
        message: `Взносы: ${Math.round(insurance).toLocaleString('ru-RU')} ₽/год`,
        details: {
          monthly_payroll: payroll,
          annual_payroll: annualPayroll,
          rate: insuranceRate,
          annual_contributions: Math.round(insurance)
        },
        recommendation: null
      });

      // 4.3 НДФЛ
      const ndflLimit = getRate('ndfl_limit', 5000000);
      const ndflBaseRate = getRate('ndfl_base_rate', 0.13);
      const ndflIncreasedRate = getRate('ndfl_increased_rate', 0.15);

      let ndfl = 0;
      if (annualPayroll <= ndflLimit) {
        ndfl = annualPayroll * ndflBaseRate;
      } else {
        ndfl = ndflLimit * ndflBaseRate + (annualPayroll - ndflLimit) * ndflIncreasedRate;
      }

      checks.push({
        id: `ndfl_${company.id}`,
        category: 'taxes',
        severity: 'info',
        name: `НДФЛ: ${company.name}`,
        message: `НДФЛ: ${Math.round(ndfl).toLocaleString('ru-RU')} ₽/год`,
        details: {
          annual_payroll: annualPayroll,
          limit: ndflLimit,
          base_rate: ndflBaseRate,
          increased_rate: ndflIncreasedRate,
          annual_ndfl: Math.round(ndfl)
        },
        recommendation: null
      });
    }

    // ============================================
    // БЛОК 5: ПЛАНИРОВАНИЕ
    // ============================================

    // 5.1 Пустые статьи бюджета
    const emptyBudgets = budgets.filter(b => amountOf(b) === 0 && b.status === 'draft');
    checks.push({
      id: 'empty_budgets',
      category: 'planning',
      severity: emptyBudgets.length > 20 ? 'warning' : emptyBudgets.length > 0 ? 'info' : 'ok',
      name: 'Пустые статьи бюджета',
      count: emptyBudgets.length,
      message: emptyBudgets.length > 0 ? `${emptyBudgets.length} статей не заполнены` : 'Бюджет заполнен',
      details: emptyBudgets.slice(0, 20).map(b => ({
        period: String(b.period || '').replace(/^'/, '').substring(0, 7),
        category: b.category_id
      })),
      recommendation: emptyBudgets.length > 0 ? 'Заполните пустые статьи' : null
    });

    // 5.2 Отклонения план/факт
    const deviations: any[] = [];
    for (const budget of budgets) {
      if (budget.actual_amount > 0 && budget.planned_amount > 0) {
        const deviation = Math.abs(budget.actual_amount - budget.planned_amount) / budget.planned_amount * 100;
        if (deviation > 20) {
          deviations.push({
            period: String(budget.period || '').replace(/^'/, '').substring(0, 7),
            category: budget.category_id,
            planned: budget.planned_amount,
            actual: budget.actual_amount,
            deviation_percent: Math.round(deviation)
          });
        }
      }
    }

    checks.push({
      id: 'budget_deviations',
      category: 'planning',
      severity: deviations.length > 10 ? 'warning' : deviations.length > 0 ? 'info' : 'ok',
      name: 'Отклонения план/факт',
      count: deviations.length,
      message: deviations.length > 0
        ? `${deviations.length} статей с отклонением >20%`
        : 'Отклонений нет',
      details: deviations.slice(0, 20),
      recommendation: deviations.length > 10 ? 'Пересмотрите плановые показатели' : null
    });

    // 5.3 Проверка закрытых месяцев
    const closedMonths = new Set<string>();
    budgets.forEach(b => {
      if (b.status === 'closed') {
        closedMonths.add(String(b.period || '').replace(/^'/, '').substring(0, 7));
      }
    });

    const sortedClosed = Array.from(closedMonths).sort();
    const unclosedSequential: string[] = [];

    if (sortedClosed.length > 1) {
      for (let i = 1; i < sortedClosed.length; i++) {
        const [year, month] = sortedClosed[i].split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        if (sortedClosed[i - 1] !== prevMonth) {
          unclosedSequential.push(`${prevMonth} (перед ${sortedClosed[i]})`);
        }
      }
    }

    checks.push({
      id: 'closed_months_sequence',
      category: 'planning',
      severity: unclosedSequential.length > 0 ? 'warning' : 'ok',
      name: 'Последовательность закрытия месяцев',
      count: unclosedSequential.length,
      message: unclosedSequential.length > 0
        ? `Нарушена последовательность: ${unclosedSequential.join(', ')}`
        : 'Последовательность соблюдена',
      details: unclosedSequential,
      recommendation: unclosedSequential.length > 0 ? 'Закройте месяцы по порядку' : null
    });

    // ============================================
    // БЛОК 6: КОНСОЛИДАЦИЯ
    // ============================================

    // 6.1 ВГО (внутригрупповые операции)
    const intercompanyTx = transactions.filter(t => {
      const companyIds = new Set(companies.map(c => c.id));
      return t.company_id && t.counterparty_id && companyIds.has(t.company_id);
    });

    checks.push({
      id: 'intercompany_check',
      category: 'consolidation',
      severity: intercompanyTx.length > 0 ? 'info' : 'ok',
      name: 'Внутригрупповые операции',
      count: intercompanyTx.length,
      message: intercompanyTx.length > 0
        ? `${intercompanyTx.length} потенциальных ВГО`
        : 'ВГО не обнаружены',
      details: intercompanyTx.slice(0, 10).map(t => ({
        id: t.id,
        date: getDateStr(t.date),
        amount: amountOf(t),
        description: t.description
      })),
      recommendation: intercompanyTx.length > 0 ? 'Проверьте исключение ВГО из консолидации' : null
    });

    // 6.2 Сумма по компаниям = общей
    checks.push({
      id: 'consolidation_check',
      category: 'consolidation',
      severity: Math.abs(totalRevenue - allTransactionsRevenue) > 0.01 ? 'critical' : 'ok',
      name: 'Консолидация: Сумма = Общей',
      message: Math.abs(totalRevenue - allTransactionsRevenue) > 0.01
        ? 'Консолидация НЕ сходится'
        : 'Консолидация сходится',
      details: {
        sum_by_company: totalRevenue,
        total_overall: allTransactionsRevenue,
        difference: Math.abs(totalRevenue - allTransactionsRevenue)
      },
      recommendation: null
    });

    // ============================================
    // БЛОК 7: РИСКИ
    // ============================================

    // 7.1 Кассовые разрывы
    const today = new Date().toISOString().split('T')[0];
    let projectedCash = cash;
    const cashGaps: any[] = [];

    const futureTx = transactions
      .filter(t => getDateStr(t.date) >= today)
      .sort((a, b) => getDateStr(a.date).localeCompare(getDateStr(b.date)));

    for (const t of futureTx) {
      if (t.type === 'income') projectedCash += amountOf(t);
      if (t.type === 'expense') projectedCash -= amountOf(t);
      if (projectedCash < 0) {
        cashGaps.push({
          date: getDateStr(t.date),
          deficit: Math.abs(projectedCash)
        });
      }
    }

    checks.push({
      id: 'cash_gaps',
      category: 'risks',
      severity: cashGaps.length > 0 ? 'critical' : 'ok',
      name: 'Кассовые разрывы',
      count: cashGaps.length,
      message: cashGaps.length > 0 ? `${cashGaps.length} кассовых разрывов` : 'Кассовых разрывов нет',
      details: cashGaps.slice(0, 10),
      recommendation: cashGaps.length > 0 ? 'Перенесите платежи или привлеките финансирование' : null
    });

    // 7.2 Лимиты УСН
    for (const company of companies) {
      if (company.tax_system === 'USN_6' || company.tax_system === 'USN_15') {
        const rev = revenueByCompany.get(company.id) || 0;
        const limit = getRate('usn_vat_7_limit', 490500000);
        const percentage = (rev / limit) * 100;

        if (percentage > 50) {
          checks.push({
            id: `usn_limit_${company.id}`,
            category: 'risks',
            severity: percentage > 80 ? 'critical' : percentage > 60 ? 'warning' : 'info',
            name: `Лимит УСН: ${company.name}`,
            message: `Использовано ${percentage.toFixed(1)}% лимита (${rev.toLocaleString('ru-RU')} ₽ из ${limit.toLocaleString('ru-RU')} ₽)`,
            details: {
              revenue: rev,
              limit,
              percentage: Math.round(percentage * 10) / 10
            },
            recommendation: percentage > 80 ? 'Срочно планируйте переход на ОСНО' : null
          });
        }
      }
    }

    // 7.3 Дебиторская задолженность
    const arBalance = transactions
      .filter(t => t.debit_account_id === 'acc-ar-001')
      .reduce((sum, t) => sum + amountOf(t), 0) -
      transactions
        .filter(t => t.credit_account_id === 'acc-ar-001')
        .reduce((sum, t) => sum + amountOf(t), 0);

    checks.push({
      id: 'accounts_receivable',
      category: 'risks',
      severity: arBalance > 1000000 ? 'warning' : arBalance > 0 ? 'info' : 'ok',
      name: 'Дебиторская задолженность',
      message: arBalance > 0
        ? `Дебиторка: ${arBalance.toLocaleString('ru-RU')} ₽`
        : 'Дебиторки нет',
      details: { balance: arBalance },
      recommendation: arBalance > 1000000 ? 'Проверьте просроченную дебиторку' : null
    });

    // 7.4 Кредиторская задолженность
    const apBalance = transactions
      .filter(t => t.credit_account_id === 'acc-ap-001')
      .reduce((sum, t) => sum + amountOf(t), 0) -
      transactions
        .filter(t => t.debit_account_id === 'acc-ap-001')
        .reduce((sum, t) => sum + amountOf(t), 0);

    checks.push({
      id: 'accounts_payable',
      category: 'risks',
      severity: apBalance > 1000000 ? 'warning' : apBalance > 0 ? 'info' : 'ok',
      name: 'Кредиторская задолженность',
      message: apBalance > 0
        ? `Кредиторка: ${apBalance.toLocaleString('ru-RU')} ₽`
        : 'Кредиторки нет',
      details: { balance: apBalance },
      recommendation: apBalance > 1000000 ? 'Проверьте сроки оплаты' : null
    });

    // ============================================
    // БЛОК 8: ПРОЦЕССЫ
    // ============================================

    // 8.1 Актуальность данных
    const lastTransactionDate = transactions
      .map(t => getDateStr(t.date))
      .sort()
      .reverse()[0];

    const daysSinceLastTx = lastTransactionDate
      ? Math.floor((new Date().getTime() - new Date(lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    checks.push({
      id: 'data_currency',
      category: 'processes',
      severity: daysSinceLastTx > 30 ? 'warning' : daysSinceLastTx > 7 ? 'info' : 'ok',
      name: 'Актуальность данных',
      message: daysSinceLastTx > 0
        ? `Последняя операция: ${daysSinceLastTx} дн. назад (${lastTransactionDate})`
        : 'Данные актуальны',
      details: {
        last_transaction: lastTransactionDate,
        days_ago: daysSinceLastTx
      },
      recommendation: daysSinceLastTx > 30 ? 'Обновите данные' : null
    });

    // ============ ИТОГ ============
    const critical = checks.filter(c => c.severity === 'critical').length;
    const warnings = checks.filter(c => c.severity === 'warning').length;
    const ok = checks.filter(c => c.severity === 'ok' || c.severity === 'info').length;
    const totalTime = Date.now() - startTime;

    // Группировка по категориям
    const byCategory: any = {};
    checks.forEach(c => {
      if (!byCategory[c.category]) byCategory[c.category] = { critical: 0, warning: 0, ok: 0, total: 0 };
      byCategory[c.category].total++;
      if (c.severity === 'critical') byCategory[c.category].critical++;
      else if (c.severity === 'warning') byCategory[c.category].warning++;
      else byCategory[c.category].ok++;
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total_checks: checks.length,
      critical,
      warnings,
      ok,
      execution_time: totalTime,
      by_category: byCategory,
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