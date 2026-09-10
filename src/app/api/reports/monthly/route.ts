import { NextRequest, NextResponse } from 'next/server';
import { monthlyEngine } from '@/lib/engine/monthly';
import { taxEngine } from '@/lib/engine/tax';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id') || '';
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    const periodType = url.searchParams.get('period_type') || 'monthly';
    const reportType = url.searchParams.get('report_type') || 'pnl';

    const [transactions, accounts, companies, settings] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies'),
      gasGet('Settings')
    ]);

    // Загружаем настройки в taxEngine
    await taxEngine.loadSettings(settings);

    let data;

    if (companyId) {
      const company = companies.find((c: any) => c.id === companyId);
      data = monthlyEngine.getPeriodBreakdown(
        transactions,
        accounts,
        companyId,
        periodStart,
        periodEnd,
        periodType as any,
        company,
        reportType as any
      );
    } else {
      // Агрегируем по всем компаниям
      const allData = companies.flatMap((company: any) =>
        monthlyEngine.getPeriodBreakdown(
          transactions,
          accounts,
          company.id,
          periodStart,
          periodEnd,
          periodType as any,
          company,
          reportType as any
        )
      );
      // Агрегируем по периодам
      const periodsMap = new Map<string, any>();

      for (const item of allData) {
        if (!periodsMap.has(item.period)) {
          // Инициализируем аккумулятор нулями
          periodsMap.set(item.period, {
            period: item.period,
            revenue: 0,
            expenses: 0,
            profit: 0,
            cash_in: 0,
            cash_out: 0,
            net_cash_flow: 0,
            starting_balance: 0,
            ending_balance: 0,
            tax_outflow: 0,
            details: {}
          });
        }
        const existing = periodsMap.get(item.period)!;
        existing.revenue += item.revenue;
        existing.expenses += item.expenses;
        existing.profit += item.profit;
        existing.cash_in += item.cash_in;
        existing.cash_out += item.cash_out;
        existing.net_cash_flow += item.net_cash_flow;
        existing.starting_balance += item.starting_balance || 0;
        existing.ending_balance += item.ending_balance;
        existing.tax_outflow += item.tax_outflow || 0;

        // Объединяем details
        for (const [accId, amount] of Object.entries(item.details)) {
          existing.details[accId] = (existing.details[accId] || 0) + (amount as number);
        }
      }

      data = Array.from(periodsMap.values())
        .sort((a, b) => a.period.localeCompare(b.period));
    }

    return NextResponse.json({
      periods: data,
      accounts: accounts,
      report_type: reportType
    });

  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}