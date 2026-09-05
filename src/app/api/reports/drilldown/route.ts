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
    const accountId = url.searchParams.get('account_id') || '';
    const rowType = url.searchParams.get('type') || 'all';
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    const companyId = url.searchParams.get('company_id') || '';

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

    // ============ ФИЛЬТРАЦИЯ ПО ТИПУ СТАТЬИ ============

    switch (rowType) {
      case 'income':
        // Доходы — операции с кредитовым счётом типа I
        filtered = filtered.filter((t: any) => {
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);
          return creditAcc?.type === 'I';
        });
        break;

      case 'cogs':
        // Себестоимость — операции с дебетовым счётом is_cost_of_goods = true
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          return Boolean(debitAcc?.is_cost_of_goods);
        });
        break;

      case 'cash_in_operating':
        // Поступления по операционной деятельности
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          // Деньги пришли на денежный счёт
          if (!(Boolean(debitAcc?.is_cash_flow))) return false;

          // Источник — доход (I) — операционный
          if (creditAcc?.type === 'I') return true;

          return false;
        });
        break;

      case 'cash_out_operating':
        // Выбытия по операционной деятельности
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          // Деньги ушли с денежного счёта
          if (!(Boolean(creditAcc?.is_cash_flow))) return false;

          // Назначение — расход (X) — операционный
          if (debitAcc?.type === 'X' && !debitAcc.id.startsWith('acc-tax-')) return true;

          return false;
        });
        break;

      case 'cash_in_investing':
        // Поступления от инвестиционной деятельности
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          if (!(Boolean(debitAcc?.is_cash_flow))) return false;

          // Продажа ОС или других активов
          if (creditAcc?.activity_type === 'investing') return true;
          if (creditAcc?.id === 'acc-in-invest-sale') return true;

          return false;
        });
        break;

      case 'cash_out_investing':
        // Выбытия на инвестиционную деятельность
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          if (!(Boolean(creditAcc?.is_cash_flow))) return false;

          // Покупка ОС (CAPEX)
          if (debitAcc?.activity_type === 'investing') return true;
          if (debitAcc?.id === 'acc-out-capex') return true;

          return false;
        });
        break;

      case 'cash_in_financing':
        // Поступления от финансовой деятельности
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          if (!(Boolean(debitAcc?.is_cash_flow))) return false;

          // Получение кредитов
          if (creditAcc?.activity_type === 'financing') return true;
          if (creditAcc?.id === 'acc-in-loan') return true;

          return false;
        });
        break;

      case 'cash_out_financing':
        // Выбытия на финансовую деятельность
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          const creditAcc = accounts.find((a: any) => a.id === t.credit_account_id);

          if (!(Boolean(creditAcc?.is_cash_flow))) return false;

          // Погашение кредитов, проценты, дивиденды
          if (debitAcc?.activity_type === 'financing') return true;
          if (debitAcc?.id === 'acc-out-loan-principal' ||
            debitAcc?.id === 'acc-out-loan-interest' ||
            debitAcc?.id === 'acc-out-dividends') return true;

          return false;
        });
        break;

      case 'opex':
        // Операционные расходы — расходы КРОМЕ себестоимости, налогов, амортизации
        filtered = filtered.filter((t: any) => {
          const debitAcc = accounts.find((a: any) => a.id === t.debit_account_id);
          if (!debitAcc || debitAcc.type !== 'X') return false;
          if (Boolean(debitAcc.is_cost_of_goods)) return false;
          if (debitAcc.id.startsWith('acc-tax-')) return false;
          if (debitAcc.id.startsWith('acc-depreciation-')) return false;
          return true;
        });
        break;

      case 'expense':
        // Просто расходы (без уточнения)
        filtered = filtered.filter((t: any) => t.type === 'expense');
        break;

      case 'all':
      default:
        // Если указан конкретный счёт
        if (accountId && accountId.startsWith('acc-')) {
          filtered = filtered.filter((t: any) =>
            t.debit_account_id === accountId || t.credit_account_id === accountId
          );
        }
        break;
    }

    // Если указан конкретный счёт И тип не cogs/opex
    if (accountId && accountId.startsWith('acc-') && rowType !== 'cogs' && rowType !== 'opex') {
      filtered = filtered.filter((t: any) =>
        t.debit_account_id === accountId || t.credit_account_id === accountId
      );
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