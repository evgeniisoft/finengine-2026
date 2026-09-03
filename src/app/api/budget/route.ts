import { NextRequest, NextResponse } from 'next/server';
import { budgetEngine } from '@/lib/engine/budget';
import { taxEngine } from '@/lib/engine/tax';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function gasCreate(sheet: string, data: any): Promise<any> {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', sheet, data })
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
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
    let filteredBudgets = budgets.filter((b: any) => {
      const cleanPeriod = String(b.period || '').replace(/^'/, '');
      return cleanPeriod.startsWith(year) && b.scenario === scenario;
    });
    if (companyId) {
      filteredBudgets = filteredBudgets.filter((b: any) => b.company_id === companyId);
    } else {
      // Если компания не выбрана — агрегируем по всем компаниям
      const aggregated = new Map<string, any>();
      for (const budget of filteredBudgets) {
        const key = `${budget.category_id}_${budget.period}`;
        if (!aggregated.has(key)) {
          aggregated.set(key, { ...budget });
        } else {
          aggregated.get(key).planned_amount += budget.planned_amount;
          aggregated.get(key).actual_amount += budget.actual_amount;
        }
      }
      filteredBudgets = Array.from(aggregated.values());
    }

    // Считаем фактические данные по месяцам
    const actualsByCategory = new Map<string, Map<string, number>>();
    for (const tx of transactions) {
      const txDate = typeof tx.date === 'string' ? tx.date.split('T')[0] : String(tx.date || '').split('T')[0];
      const month = txDate.substring(0, 7);
      // Для доходов — берём credit_account_id, для расходов — debit_account_id
      const catId = tx.type === 'income'
        ? tx.credit_account_id
        : tx.type === 'expense'
          ? tx.debit_account_id
          : '';

      if (!actualsByCategory.has(catId)) {
        actualsByCategory.set(catId, new Map());
      }
      const currentAmount = actualsByCategory.get(catId)!.get(month) || 0;
      actualsByCategory.get(catId)!.set(month, currentAmount + parseFloat(String(tx.amount || 0)));
    }

    return NextResponse.json({
      budgets: filteredBudgets,
      transactions,
      accounts,
      companies,
      actualsByCategory: Object.fromEntries(
        Array.from(actualsByCategory.entries()).map(([catId, monthsMap]) => [
          catId,
          Object.fromEntries(monthsMap)
        ])
      )
    });

  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка: ' + (error as Error).message }, { status: 500 });
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
    if (action === 'close_month') {
      const { companyId, period, scenario } = body;

      // Получаем бюджеты
      const budgets = await gasGet('Budgets');
      // Проверяем, что предыдущий месяц закрыт
      const periodDate = new Date(period + '-01');
      const prevDate = new Date(periodDate.getFullYear(), periodDate.getMonth() - 1, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const prevBudgets = budgets.filter((b: any) =>
        b.company_id === companyId &&
        String(b.period || '').replace(/^'/, '').substring(0, 7) === prevPeriod &&
        b.scenario === scenario
      );

      const prevClosed = prevBudgets.length === 0 || prevBudgets.every((b: any) => b.status === 'closed');

      if (!prevClosed) {
        return NextResponse.json({
          error: `Сначала закройте ${prevPeriod}`
        }, { status: 400 });
      }
      const monthBudgets = budgets.filter((b: any) =>
        b.company_id === companyId &&
        String(b.period || '').replace(/^'/, '').substring(0, 7) === period &&
        b.scenario === scenario &&
        b.status !== 'closed'
      );

      // Получаем транзакции за период
      const transactions = await gasGet('Transactions');
      const monthTx = transactions.filter(t => {
        const txDate = typeof t.date === 'string' ? t.date.split('T')[0] : String(t.date || '').split('T')[0];
        return t.company_id === companyId && txDate.substring(0, 7) === period;
      });

      let updated = 0;

      for (const budget of monthBudgets) {
        const catId = budget.category_id || budget.account_id;
        const actualTx = monthTx.filter(t =>
          t.debit_account_id === catId || t.credit_account_id === catId
        );
        const actualAmount = actualTx.reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);

        const updateUrl = `${GAS_URL}?action=update&sheet=Budgets&id=${budget.id}&data=${encodeURIComponent(JSON.stringify({
          ...budget,
          actual_amount: actualAmount,
          status: 'closed'
        }))}`;
        await fetch(updateUrl);
        updated++;
      }

      // Скользящее планирование: горизонт всегда 12 месяцев вперёд от закрытого
      const closedYear = parseInt(period.substring(0, 4));
      const closedMonth = parseInt(period.substring(5, 7));

      // Горизонт начинается со следующего месяца после закрытого
      const horizonStart = new Date(closedYear, closedMonth, 1); // следующий месяц после закрытого
      const horizonEnd = new Date(closedYear, closedMonth + 12, 1); // 12 месяцев вперёд

      const newYear = horizonEnd.getFullYear();
      const newMonthNum = horizonEnd.getMonth() + 1;
      const newPeriod = `${newYear}-${String(newMonthNum).padStart(2, '0')}`;

      // Создаём пустые бюджеты на новый месяц
      const accounts = await gasGet('Accounts');
      const incomeExpenseAccounts = accounts.filter((a: any) => a.type === 'I' || a.type === 'X');

      for (const account of incomeExpenseAccounts) {
        const newBudget = {
          id: '',
          tenant_id: 'tenant-1',
          company_id: companyId,
          category_id: account.id,
          account_id: account.id,
          period: `'${newPeriod}`,
          planned_amount: 0,
          actual_amount: 0,
          record_type: 'pnl',
          scenario: scenario,
          status: 'draft',
          payment_delay_days: 0,
          is_deleted: '',
          deleted_at: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await gasCreate('Budgets', newBudget);
      }

      return NextResponse.json({ success: true, updated, new_period: newPeriod });
    }
    if (action === 'update_cell') {
      const { companyId, categoryId, period, plannedAmount, scenario } = body;


      // Если передан budgetId — обновляем по ID напрямую
      if (body.budgetId) {
        const updateUrl = `${GAS_URL}?action=update&sheet=Budgets&id=${body.budgetId}&data=${encodeURIComponent(JSON.stringify({ planned_amount: plannedAmount }))}`;
        await fetch(updateUrl);
        return NextResponse.json({ success: true });
      }

      // Иначе — ищем по компании, статье и периоду
      const budgets = await gasGet('Budgets');
      const cleanPeriod = period.startsWith("'") ? period.slice(1) : period;
      const normalizedSearchPeriod = cleanPeriod.substring(0, 7);
      const existing = budgets.find((b: any) =>
        b.company_id === companyId &&
        b.category_id === categoryId &&
        (b.period || '').replace(/^'/, '').substring(0, 7) === normalizedSearchPeriod &&
        b.scenario === scenario
      );

      if (existing) {
        // Обновить
        const updateUrl = `${GAS_URL}?action=update&sheet=Budgets&id=${existing.id}&data=${encodeURIComponent(JSON.stringify({ ...existing, planned_amount: plannedAmount }))}`;
        await fetch(updateUrl);
        return NextResponse.json({ success: true });
      } else {
        // Создать
        const newBudget = {
          id: '',
          tenant_id: 'tenant-1',
          company_id: companyId,
          category_id: categoryId,
          account_id: categoryId,
          period: `'${period}`,
          planned_amount: plannedAmount,
          actual_amount: 0,
          record_type: 'pnl',
          scenario: scenario,
          status: 'draft',
          payment_delay_days: 0,
          is_deleted: '',
          deleted_at: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await gasCreate('Budgets', newBudget);
        return NextResponse.json({ success: true });
      }
    }

    if (action === 'auto_fill') {
      const companyId = body.companyId;
      const year = body.year || '2026';

      if (!companyId) {
        return NextResponse.json({ error: 'Не указана компания' }, { status: 400 });
      }

      const [transactions, accounts, companies] = await Promise.all([
        gasGet('Transactions'),
        gasGet('Accounts'),
        gasGet('Companies')
      ]);

      const budgets = budgetEngine.autoFillBudget(companyId, year, accounts, transactions);

      // Получаем компанию
      const company = companies.find((c: any) => c.id === companyId);
      if (company) {
        // Налоговый календарь
        const taxCalendar = taxEngine.getMonthlyTaxCalendar(company, year, budgets);

        // Добавляем налоговые статьи в бюджеты
        for (const monthData of taxCalendar) {
          for (const [taxAccountId, taxAmount] of Object.entries(monthData.taxes)) {
            if (taxAmount > 0) {
              budgets.push({
                id: '',
                tenant_id: 'tenant-1',
                company_id: companyId,
                category_id: taxAccountId,
                account_id: taxAccountId,
                period: `'${monthData.month}`,
                planned_amount: taxAmount,
                actual_amount: 0,
                record_type: 'pnl',
                scenario: 'base',
                status: 'draft',
                payment_delay_days: 0,
                is_deleted: '',
                deleted_at: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }

      // Защищаем period от преобразования в дату
      budgets.forEach(b => {
        b.period = `'${b.period}`;
      });

      // Сохраняем бюджеты
      for (const budget of budgets) {
        await gasCreate('Budgets', budget);
      }

      return NextResponse.json({ success: true, count: budgets.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка: ' + (error as Error).message }, { status: 500 });
  }
}