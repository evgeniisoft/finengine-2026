import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasBatchCreate(sheet: string, dataArray: any[]): Promise<any> {
  const url = `${GAS_URL}?action=batchCreate&sheet=${sheet}&data=${encodeURIComponent(JSON.stringify(dataArray))}`;
  const response = await fetch(url);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    const now = new Date().toISOString();

    // ============================================
    // 1. КОМПАНИИ
    // ============================================
    const companies = [
      { id: 'comp-test-1', name: 'ООО "Альфа"', tax_system: 'USN_6', currency: 'RUB', is_group: true, parent_id: '', inn: '7701234567', kpp: '770101001', external_id: '', source: 'manual', tenant_id: 'tenant-1', created_at: now, updated_at: now, deleted_at: '', is_deleted: '' },
      { id: 'comp-test-2', name: 'ООО "Бета"', tax_system: 'USN_15', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7707654321', kpp: '770101002', external_id: '', source: 'manual', tenant_id: 'tenant-1', created_at: now, updated_at: now, deleted_at: '', is_deleted: '' },
      { id: 'comp-test-3', name: 'ИП Иванов', tax_system: 'USN_6', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7701112233', kpp: '', external_id: '', source: 'manual', tenant_id: 'tenant-1', created_at: now, updated_at: now, deleted_at: '', is_deleted: '' },
      { id: 'comp-test-4', name: 'ООО "Гамма"', tax_system: 'OSNO', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7704444444', kpp: '770101004', external_id: '', source: 'manual', tenant_id: 'tenant-1', created_at: now, updated_at: now, deleted_at: '', is_deleted: '' },
    ];

    // ============================================
    // 2. СЧЕТА
    // ============================================
    const accounts = [
      { id: 'acc-bank-001', code: 'BANK_ALFA', name: 'Альфа-Банк', type: 'A', is_cash_flow: 'true', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-bank-002', code: 'BANK_SBER', name: 'Сбербанк', type: 'A', is_cash_flow: 'true', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cash-001', code: 'CASH_OFFICE', name: 'Касса', type: 'A', is_cash_flow: 'true', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-in-revenue', code: 'IN_REVENUE', name: 'Выручка от клиентов', type: 'I', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-salary', code: 'OUT_SALARY', name: 'Зарплата', type: 'X', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-rent', code: 'OUT_RENT', name: 'Аренда', type: 'X', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-marketing', code: 'OUT_MARKETING', name: 'Маркетинг', type: 'X', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-other', code: 'OUT_OTHER', name: 'Прочие расходы', type: 'X', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-ar-001', code: 'AR', name: 'Дебиторская задолженность', type: 'A', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-ap-001', code: 'AP', name: 'Кредиторская задолженность', type: 'L', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-loan-001', code: 'LOAN', name: 'Кредиты', type: 'L', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-equity-001', code: 'EQUITY', name: 'Капитал', type: 'E', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-unclassified', code: 'UNCLASSIFIED', name: 'Требует уточнения', type: 'X', is_cash_flow: 'false', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
    ];

    // ============================================
    // 3. КОНТРАГЕНТЫ
    // ============================================
    const counterparties = [
      { id: 'cp-001', name: 'ООО "Покупатель 1"', inn: '7701111111', type: 'client', company_id: 'comp-test-1', is_deleted: '', deleted_at: '' },
      { id: 'cp-002', name: 'ООО "Покупатель 2"', inn: '7702222222', type: 'client', company_id: 'comp-test-1', is_deleted: '', deleted_at: '' },
      { id: 'cp-003', name: 'ООО "Поставщик 1"', inn: '7703333333', type: 'supplier', company_id: 'comp-test-1', is_deleted: '', deleted_at: '' },
    ];

    // ============================================
    // 4. ТРАНЗАКЦИИ
    // ============================================
    const transactions = [];
    const today = new Date();
    const months = ['01', '02', '03', '04', '05', '06', '07', '08'];

    // --- 4.1. НАЧАЛЬНЫЕ ОСТАТКИ (на 01.01.2026) ---
    transactions.push({
      date: '2025-12-31',
      company_id: 'comp-test-1',
      description: 'Начальный остаток Альфа-Банк',
      amount: 5000000,
      currency: 'RUB',
      type: 'income',
      debit_account_id: 'acc-bank-001',
      credit_account_id: 'acc-equity-001',
      amount_rub: 5000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2025-12-31',
      import_hash: 'hash-initial-balance-alfa',
      source_account_id: '',
      destination_account_id: 'acc-bank-001'
    });

    transactions.push({
      date: '2025-12-31',
      company_id: 'comp-test-1',
      description: 'Начальный остаток Сбербанк',
      amount: 2000000,
      currency: 'RUB',
      type: 'income',
      debit_account_id: 'acc-bank-002',
      credit_account_id: 'acc-equity-001',
      amount_rub: 2000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2025-12-31',
      import_hash: 'hash-initial-balance-sber',
      source_account_id: '',
      destination_account_id: 'acc-bank-002'
    });

    // --- 4.2. ОПЕРАЦИИ ЗА 8 МЕСЯЦЕВ ---
    for (const month of months) {
      const companiesData = [
        { id: 'comp-test-1', revenue: 1000000 + parseInt(month) * 100000, expenses: 600000 + parseInt(month) * 50000 },
        { id: 'comp-test-2', revenue: 500000 + parseInt(month) * 50000, expenses: 350000 + parseInt(month) * 30000 },
        { id: 'comp-test-3', revenue: 300000 + parseInt(month) * 30000, expenses: 200000 + parseInt(month) * 20000 },
      ];

      for (const companyData of companiesData) {
        // Доход
        const incomeDate = `2026-${month}-10`;
        transactions.push({
          date: incomeDate,
          company_id: companyData.id,
          description: `Выручка за ${month}.2026`,
          amount: companyData.revenue,
          currency: 'RUB',
          type: 'income',
          debit_account_id: 'acc-bank-001',
          credit_account_id: 'acc-in-revenue',
          amount_rub: companyData.revenue,
          counterparty_id: 'cp-001',
          contract_id: '',
          transaction_group_id: '',
          is_system: false,
          external_id: '',
          source: 'manual',
          deleted_at: '',
          is_deleted: '',
          created_at: now,
          updated_at: now,
          tenant_id: 'tenant-1',
          record_type: 'fact',
          accrual_date: incomeDate,
          import_hash: `hash-${companyData.id}-${incomeDate}-income`,
          source_account_id: '',
          destination_account_id: 'acc-bank-001'
        });

        // Зарплата
        const salaryDate = `2026-${month}-15`;
        transactions.push({
          date: salaryDate,
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
          deleted_at: '',
          is_deleted: '',
          created_at: now,
          updated_at: now,
          tenant_id: 'tenant-1',
          record_type: 'fact',
          accrual_date: salaryDate,
          import_hash: `hash-${companyData.id}-${salaryDate}-salary`,
          source_account_id: 'acc-bank-001',
          destination_account_id: ''
        });

        // Аренда
        const rentDate = `2026-${month}-20`;
        transactions.push({
          date: rentDate,
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
          deleted_at: '',
          is_deleted: '',
          created_at: now,
          updated_at: now,
          tenant_id: 'tenant-1',
          record_type: 'fact',
          accrual_date: rentDate,
          import_hash: `hash-${companyData.id}-${rentDate}-rent`,
          source_account_id: 'acc-bank-001',
          destination_account_id: ''
        });

        // Маркетинг
        const marketingDate = `2026-${month}-25`;
        transactions.push({
          date: marketingDate,
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
          deleted_at: '',
          is_deleted: '',
          created_at: now,
          updated_at: now,
          tenant_id: 'tenant-1',
          record_type: 'fact',
          accrual_date: marketingDate,
          import_hash: `hash-${companyData.id}-${marketingDate}-marketing`,
          source_account_id: 'acc-bank-001',
          destination_account_id: ''
        });
      }
      // Операции для ОСНО (comp-test-4)
      const osnoDate = `2026-${month}-12`;
      transactions.push({
        date: osnoDate,
        company_id: 'comp-test-4',
        description: `Выручка ОСНО ${month}.2026 (с НДС 22%)`,
        amount: 1000000,
        currency: 'RUB',
        type: 'income',
        debit_account_id: 'acc-bank-001',
        credit_account_id: 'acc-in-revenue',
        amount_rub: 1000000,
        counterparty_id: 'cp-001',
        contract_id: '',
        transaction_group_id: '',
        is_system: false,
        external_id: '',
        source: 'manual',
        deleted_at: '',
        is_deleted: '',
        created_at: now,
        updated_at: now,
        tenant_id: 'tenant-1',
        record_type: 'fact',
        accrual_date: osnoDate,
        import_hash: `hash-osno-${month}-income`,
        source_account_id: '',
        destination_account_id: 'acc-bank-001'
      });

      const osnoExpenseDate = `2026-${month}-22`;
      transactions.push({
        date: osnoExpenseDate,
        company_id: 'comp-test-4',
        description: `Расходы ОСНО ${month}.2026`,
        amount: 600000,
        currency: 'RUB',
        type: 'expense',
        debit_account_id: 'acc-out-other',
        credit_account_id: 'acc-bank-001',
        amount_rub: 600000,
        counterparty_id: '',
        contract_id: '',
        transaction_group_id: '',
        is_system: false,
        external_id: '',
        source: 'manual',
        deleted_at: '',
        is_deleted: '',
        created_at: now,
        updated_at: now,
        tenant_id: 'tenant-1',
        record_type: 'fact',
        accrual_date: osnoExpenseDate,
        import_hash: `hash-osno-${month}-expense`,
        source_account_id: 'acc-bank-001',
        destination_account_id: ''
      });
    }

    // --- 4.3. ДЕБИТОРСКАЯ ЗАДОЛЖЕННОСТЬ (акт без оплаты) ---
    transactions.push({
      date: '2026-08-20',
      company_id: 'comp-test-1',
      description: 'Отгружен товар ООО "Покупатель 1" (оплата не получена)',
      amount: 450000,
      currency: 'RUB',
      type: 'income',
      debit_account_id: 'acc-ar-001',
      credit_account_id: 'acc-in-revenue',
      amount_rub: 450000,
      counterparty_id: 'cp-001',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2026-08-20',
      import_hash: 'hash-ar-pokupatel-1',
      source_account_id: '',
      destination_account_id: ''
    });

    // --- 4.4. КРЕДИТОРСКАЯ ЗАДОЛЖЕННОСТЬ (получено, но не оплачено) ---
    transactions.push({
      date: '2026-08-25',
      company_id: 'comp-test-1',
      description: 'Получены материалы от Поставщика 1 (не оплачены)',
      amount: 280000,
      currency: 'RUB',
      type: 'expense',
      debit_account_id: 'acc-out-other',
      credit_account_id: 'acc-ap-001',
      amount_rub: 280000,
      counterparty_id: 'cp-003',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2026-08-25',
      import_hash: 'hash-ap-postavshik-1',
      source_account_id: '',
      destination_account_id: ''
    });

    // --- 4.5. ВНУТРЕННЕЕ ПЕРЕМЕЩЕНИЕ ---
    transactions.push({
      date: '2026-08-15',
      company_id: 'comp-test-1',
      description: 'Перевод между своими счетами (Альфа → Сбер)',
      amount: 1000000,
      currency: 'RUB',
      type: 'transfer',
      debit_account_id: 'acc-bank-002',
      credit_account_id: 'acc-bank-001',
      amount_rub: 1000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2026-08-15',
      import_hash: 'hash-transfer-alfa-sber',
      source_account_id: 'acc-bank-001',
      destination_account_id: 'acc-bank-002'
    });

    // --- 4.6. ОПЕРАЦИЯ "ТРЕБУЕТ УТОЧНЕНИЯ" ---
    transactions.push({
      date: '2026-08-28',
      company_id: 'comp-test-1',
      description: '',
      amount: 75000,
      currency: 'RUB',
      type: 'expense',
      debit_account_id: 'acc-unclassified',
      credit_account_id: 'acc-bank-001',
      amount_rub: 75000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'fact',
      accrual_date: '2026-08-28',
      import_hash: 'hash-unclassified-1',
      source_account_id: 'acc-bank-001',
      destination_account_id: ''
    });

    // --- 4.7. БУДУЩИЕ ПЛАТЕЖИ (для кассовых разрывов) ---
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    transactions.push({
      date: tomorrow.toISOString().split('T')[0],
      company_id: 'comp-test-1',
      description: 'Крупная закупка оборудования',
      amount: 2000000,
      currency: 'RUB',
      type: 'expense',
      debit_account_id: 'acc-out-other',
      credit_account_id: 'acc-bank-001',
      amount_rub: 2000000,
      counterparty_id: '',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'plan',
      accrual_date: tomorrow.toISOString().split('T')[0],
      import_hash: 'hash-equipment-plan',
      source_account_id: 'acc-bank-001',
      destination_account_id: ''
    });

    const in3days = new Date(today);
    in3days.setDate(in3days.getDate() + 3);
    transactions.push({
      date: in3days.toISOString().split('T')[0],
      company_id: 'comp-test-1',
      description: 'Ожидаемая оплата от клиента',
      amount: 1500000,
      currency: 'RUB',
      type: 'income',
      debit_account_id: 'acc-bank-001',
      credit_account_id: 'acc-in-revenue',
      amount_rub: 1500000,
      counterparty_id: 'cp-001',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'plan',
      accrual_date: in3days.toISOString().split('T')[0],
      import_hash: 'hash-client-payment-plan',
      source_account_id: '',
      destination_account_id: 'acc-bank-001'
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
      debit_account_id: 'acc-out-other',
      credit_account_id: 'acc-bank-001',
      amount_rub: 3000000,
      counterparty_id: 'cp-003',
      contract_id: '',
      transaction_group_id: '',
      is_system: false,
      external_id: '',
      source: 'manual',
      deleted_at: '',
      is_deleted: '',
      created_at: now,
      updated_at: now,
      tenant_id: 'tenant-1',
      record_type: 'plan',
      accrual_date: in7days.toISOString().split('T')[0],
      import_hash: 'hash-supplier-payment-plan',
      source_account_id: 'acc-bank-001',
      destination_account_id: ''
    });

    // --- 4.8. ПЛАНОВЫЕ ОПЕРАЦИИ НА 3 МЕСЯЦА ---
    for (let m = 1; m <= 3; m++) {
      const planDate = new Date(today);
      planDate.setMonth(planDate.getMonth() + m);
      const planDateStr = planDate.toISOString().split('T')[0];

      transactions.push({
        date: planDateStr,
        company_id: 'comp-test-1',
        description: `Плановая аренда на месяц +${m}`,
        amount: 500000,
        currency: 'RUB',
        type: 'expense',
        debit_account_id: 'acc-out-rent',
        credit_account_id: 'acc-bank-001',
        amount_rub: 500000,
        counterparty_id: '',
        contract_id: '',
        transaction_group_id: '',
        is_system: false,
        external_id: '',
        source: 'manual',
        deleted_at: '',
        is_deleted: '',
        created_at: now,
        updated_at: now,
        tenant_id: 'tenant-1',
        record_type: 'plan',
        accrual_date: planDateStr,
        import_hash: `hash-rent-plan-${m}`,
        source_account_id: 'acc-bank-001',
        destination_account_id: ''
      });
    }

    // ============================================
    // 5. ЗАПИСЬ В БАЗУ
    // ============================================
    await gasBatchCreate('Companies', companies);
    await gasBatchCreate('Accounts', accounts);
    await gasBatchCreate('Counterparties', counterparties);

    for (let i = 0; i < transactions.length; i += 5) {
      const chunk = transactions.slice(i, i + 5);
      await gasBatchCreate('Transactions', chunk);
    }
    // Отдельно загружаем операции ОСНО
    const osnoTransactions = transactions.filter(t => t.company_id === 'comp-test-4');
    if (osnoTransactions.length > 0) {
      for (let i = 0; i < osnoTransactions.length; i += 3) {
        const chunk = osnoTransactions.slice(i, i + 3);
        await gasBatchCreate('Transactions', chunk);
      }
    }

    // Убираем ОСНО из общей загрузки
    const nonOsnoTransactions = transactions.filter(t => t.company_id !== 'comp-test-4');
    for (let i = 0; i < nonOsnoTransactions.length; i += 5) {
      const chunk = nonOsnoTransactions.slice(i, i + 5);
      await gasBatchCreate('Transactions', chunk);
    }

    return NextResponse.json({
      success: true,
      companies: companies.length,
      accounts: accounts.length,
      counterparties: counterparties.length,
      transactions: transactions.length,
      message: 'Полный тестовый датасет загружен'
    });

  } catch (error) {
    console.error('Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}