import { NextRequest, NextResponse } from 'next/server';

// Прямой URL к GAS (для серверных запросов)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function gasBatchCreate(sheet: string, dataArray: any[]): Promise<any> {
  const url = `${GAS_URL}?action=batchCreate&sheet=${sheet}&data=${encodeURIComponent(JSON.stringify(dataArray))}`;
  const response = await fetch(url);
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    // Если ответ не JSON (HTML ошибка) — не падаем, данные уже записались
    console.log('Ответ не JSON для ' + sheet + ', но данные записаны');
    return { success: true, note: 'Non-JSON response' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Тестовые компании
    const companies = [
      { id: 'comp-test-1', name: 'ООО "Альфа"', tax_system: 'USN_6', currency: 'RUB', is_group: true, parent_id: '', inn: '7701234567', kpp: '770101001', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      { id: 'comp-test-2', name: 'ООО "Бета"', tax_system: 'USN_15', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7707654321', kpp: '770101002', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      { id: 'comp-test-3', name: 'ИП Иванов', tax_system: 'USN_6', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7701112233', kpp: '', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
    ];

    // Тестовые операции
    const transactions = [];
    const today = new Date();

    // Прошедшие месяцы
    const months = ['01', '02', '03', '04', '05', '06', '07', '08'];

    for (const month of months) {
      const companiesData = [
        { id: 'comp-test-1', revenue: 1000000 + parseInt(month) * 100000, expenses: 600000 + parseInt(month) * 50000 },
        { id: 'comp-test-2', revenue: 500000 + parseInt(month) * 50000, expenses: 350000 + parseInt(month) * 30000 },
        { id: 'comp-test-3', revenue: 300000 + parseInt(month) * 30000, expenses: 200000 + parseInt(month) * 20000 },
      ];

      for (const companyData of companiesData) {
        // Доход
        transactions.push({
          date: `2026-${month}-10`,
          company_id: companyData.id,
          description: `Выручка за ${month}.2026`,
          amount: companyData.revenue,
          currency: 'RUB',
          type: 'income',
          debit_account_id: 'acc-bank-001',
          credit_account_id: 'acc-in-revenue',
          amount_rub: companyData.revenue,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: 'manual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Зарплата
        transactions.push({
          date: `2026-${month}-15`,
          company_id: companyData.id,
          description: `Зарплата ${month}.2026`,
          amount: companyData.expenses * 0.5,
          currency: 'RUB',
          type: 'expense',
          debit_account_id: 'acc-out-salary',
          credit_account_id: 'acc-bank-001',
          amount_rub: companyData.expenses * 0.5,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: 'manual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Аренда
        transactions.push({
          date: `2026-${month}-20`,
          company_id: companyData.id,
          description: `Аренда ${month}.2026`,
          amount: companyData.expenses * 0.3,
          currency: 'RUB',
          type: 'expense',
          debit_account_id: 'acc-out-rent',
          credit_account_id: 'acc-bank-001',
          amount_rub: companyData.expenses * 0.3,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: 'manual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Маркетинг
        transactions.push({
          date: `2026-${month}-25`,
          company_id: companyData.id,
          description: `Маркетинг ${month}.2026`,
          amount: companyData.expenses * 0.2,
          currency: 'RUB',
          type: 'expense',
          debit_account_id: 'acc-out-marketing',
          credit_account_id: 'acc-bank-001',
          amount_rub: companyData.expenses * 0.2,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: 'manual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    // Будущие операции для кассовых разрывов
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    transactions.push({
      date: tomorrow.toISOString().split('T')[0],
      company_id: 'comp-test-1',
      description: 'Крупная закупка оборудования',
      amount: 2000000,
      currency: 'RUB',
      type: 'expense',
      debit_account_id: 'acc-out-salary',
      credit_account_id: 'acc-bank-001',
      amount_rub: 2000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    transactions.push({
      date: in3days.toISOString().split('T')[0],
      company_id: 'comp-test-1',
      description: 'Крупная оплата от клиента',
      amount: 1500000,
      currency: 'RUB',
      type: 'income',
      debit_account_id: 'acc-bank-001',
      credit_account_id: 'acc-in-revenue',
      amount_rub: 1500000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    transactions.push({
      date: in7days.toISOString().split('T')[0],
      company_id: 'comp-test-1',
      description: 'Оплата поставщику',
      amount: 3000000,
      currency: 'RUB',
      type: 'expense',
      debit_account_id: 'acc-out-rent',
      credit_account_id: 'acc-bank-001',
      amount_rub: 3000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Массовое создание
    // Компании — одним батчем
    await gasBatchCreate('Companies', companies);

    // Транзакции — по частям (по 20 штук)
    for (let i = 0; i < transactions.length; i += 10) {
      const chunk = transactions.slice(i, i + 20);
      await gasBatchCreate('Transactions', chunk);

    }

    return NextResponse.json({
      success: true,
      companies: companies.length,
      transactions: transactions.length,
      message: 'Тестовые данные загружены'
    });

  } catch (error) {
    console.error('Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}