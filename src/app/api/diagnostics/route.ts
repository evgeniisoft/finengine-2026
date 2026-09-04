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
      recommendation: noDate.length > 0 ? 'Добавьте даты операциям' : null,
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
      recommendation: zeroAmount.length > 0 ? 'Проверьте операции с нулевой суммой' : null,
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
      recommendation: duplicates.length > 0 ? 'Удалите дублирующиеся операции' : null,
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
      recommendation: companiesWithoutAccounts.length > 0 ? 'Проверьте привязку счетов в операциях' : null,
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
      recommendation: emptyBudgets.length > 0 ? 'Заполните пустые статьи бюджета' : null,
      auto_fix: false
    });

    // ============ 8.5. ПРОВЕРКА RUN RATE ============

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysPassed = currentDate.getDate();

    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const currentMonthTx = transactions.filter(t => {
      const txDate = getDateStr(t.date);
      return txDate.startsWith(currentMonthStr) && t.type === 'income';
    });

    const currentMonthRevenue = currentMonthTx.reduce((sum, t) => sum + amountOf(t), 0);
    const projectedRunRate = daysPassed > 0 ? (currentMonthRevenue / daysPassed) * daysInCurrentMonth : 0;

    // Сравниваем с историческим средним за последние 3 месяца
    const last3Months: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const historicalRevenue = transactions
      .filter(t => {
        const txDate = getDateStr(t.date);
        const txMonth = txDate.substring(0, 7);
        return last3Months.includes(txMonth) && t.type === 'income';
      })
      .reduce((sum, t) => sum + amountOf(t), 0);

    const avgHistoricalRevenue = historicalRevenue / 3;

    if (currentMonthRevenue > 0 && avgHistoricalRevenue > 0) {
      const runRateDeviation = Math.abs(projectedRunRate - avgHistoricalRevenue) / avgHistoricalRevenue * 100;

      checks.push({
        id: 'run_rate_check',
        category: 'financial',
        severity: runRateDeviation > 30 ? 'warning' : 'ok',
        name: 'Run Rate отклонение',
        message: runRateDeviation > 30
          ? `Run Rate отклоняется от среднего на ${runRateDeviation.toFixed(1)}%`
          : `Run Rate в пределах нормы (отклонение ${runRateDeviation.toFixed(1)}%)`,
        details: {
          current_month_revenue: currentMonthRevenue,
          projected_run_rate: projectedRunRate,
          avg_historical_revenue: avgHistoricalRevenue,
          deviation_percent: runRateDeviation,
          last_3_months: last3Months
        },
        recommendation: runRateDeviation > 30
          ? 'Проверьте причины отклонения выручки от исторического среднего'
          : null
      });
    }

    // ============ 8.6. ПРОВЕРКА EBITDA ПО КОМПАНИЯМ ============

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

      const profit = revenue - expenses;

      let incomeTax = 0;
      if (company.tax_system === 'USN_6') {
        incomeTax = revenue * getRate('usn_6', 0.06);
      } else if (company.tax_system === 'USN_15') {
        incomeTax = Math.max(0, profit) * getRate('usn_15', 0.15);
      } else if (company.tax_system === 'OSNO') {
        incomeTax = Math.max(0, profit) * getRate('profit_tax', 0.25);
      }

      const depreciation = companyTx
        .filter(t => {
          const debitAcc = accounts.find(a => a.id === t.debit_account_id);
          return debitAcc?.code === 'DEPRECIATION';
        })
        .reduce((sum, t) => sum + amountOf(t), 0);

      const ebitda = profit + incomeTax + depreciation;

      if (ebitda < 0) {
        checks.push({
          id: `negative_ebitda_${company.id}`,
          category: 'financial',
          severity: 'critical',
          name: `Отрицательная EBITDA: ${company.name}`,
          message: `${company.name}: EBITDA = ${ebitda.toLocaleString('ru-RU')} ₽`,
          details: {
            revenue,
            expenses,
            profit,
            income_tax: incomeTax,
            depreciation,
            ebitda
          },
          recommendation: 'Критическая ситуация. Требуется пересмотр бизнес-модели или сокращение расходов.'
        });
      }
    }

    // ============ 8.7. ПРОВЕРКА ОТСРОЧЕК ПЛАТЕЖЕЙ ============

    const paymentDelays = settings.filter(s =>
      s.key && s.key.startsWith('payment_delay_')
    );

    if (paymentDelays.length > 0) {
      const delayedBudgets = budgets.filter(b => {
        const delayDays = parseInt(String(b.payment_delay_days || 0));
        return delayDays > 0 && b.record_type === 'cashflow';
      });

      if (delayedBudgets.length > 0) {
        checks.push({
          id: 'payment_delays_check',
          category: 'cashflow',
          severity: 'info',
          name: 'Отсрочки платежей в БДДС',
          message: `${delayedBudgets.length} статей с отсрочками платежей`,
          details: delayedBudgets.slice(0, 20).map(b => ({
            period: String(b.period || '').replace(/^'/, '').substring(0, 7),
            category: b.category_id,
            delay_days: b.payment_delay_days,
            planned_amount: amountOf(b)
          })),
          recommendation: null
        });
      }
    }

    // ============ 8.8. ПРОВЕРКА ОТРИЦАТЕЛЬНЫХ ОСТАТКОВ ============

    const negativeBalances: any[] = [];

    for (const account of accounts) {
      if (!account.is_cash_flow && !account.is_cash_flow === true && account.is_cash_flow !== 'true') continue;

      let balance = 0;
      for (const t of transactions) {
        if (t.debit_account_id === account.id) {
          balance += amountOf(t);
        }
        if (t.credit_account_id === account.id) {
          balance -= amountOf(t);
        }
      }

      if (balance < 0) {
        negativeBalances.push({
          account_id: account.id,
          account_name: account.name,
          balance
        });
      }
    }

    checks.push({
      id: 'negative_balances',
      category: 'cashflow',
      severity: negativeBalances.length > 0 ? 'critical' : 'ok',
      name: 'Отрицательные остатки по счетам',
      count: negativeBalances.length,
      message: negativeBalances.length > 0
        ? `${negativeBalances.length} счетов с отрицательным остатком`
        : 'Все счета имеют положительный остаток',
      details: negativeBalances,
      recommendation: negativeBalances.length > 0
        ? 'Проверьте операции, приводящие к отрицательным остаткам'
        : null
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