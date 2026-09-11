import { NextRequest, NextResponse } from 'next/server';
import { diagnosticsEngine } from '@/lib/diagnostics/engine';
import { DiagnosticContext } from '@/lib/diagnostics/types';
import { loadSystemAccounts, getSystemAccounts } from '@/lib/config/accounts';
import { taxEngine } from '@/lib/engine/tax';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL
  || 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const year = url.searchParams.get('year') || String(new Date().getFullYear());

    // Период диагностики = весь год
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;
    const today = new Date().toISOString().split('T')[0];

    // Опции
    const checkConsistency = url.searchParams.get('consistency') !== 'false';
    const checkInfrastructure = url.searchParams.get('infrastructure') !== 'false';
    const checkBusinessRules = url.searchParams.get('business') !== 'false';

    // Загрузка данных
    const loadStart = Date.now();
    const [transactions, accounts, companies, counterparties, budgets, settings] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies'),
      gasGet('Counterparties'),
      gasGet('Budgets'),
      gasGet('Settings'),
    ]);
    const gasLoadTime = Date.now() - loadStart;

    // Загрузка системных счетов
    loadSystemAccounts(settings);

    // Загрузка настроек в taxEngine (критично!)
    await taxEngine.loadSettings(settings);

    // Преобразование settings в объект
    const settingsMap: any = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    // Контекст диагностики
    const context: DiagnosticContext = {
      transactions,
      accounts,
      companies,
      counterparties,
      budgets,
      settings: settingsMap,
      systemAccounts: getSystemAccounts(),
      periodStart,
      periodEnd,
      today,
      startTime,
      gasLoadTime,
      options: {
        checkConsistency,
        checkInfrastructure,
        checkBusinessRules,
      },
    };

    // Запуск движка
    const result = await diagnosticsEngine.run(context);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Ошибка диагностики:', error);
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка: ' + (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 }
    );
  }
}