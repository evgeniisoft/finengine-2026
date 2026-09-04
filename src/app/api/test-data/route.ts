import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasBatchCreate(sheet: string, dataArray: any[]): Promise<any> {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'batchCreate',
      sheet: sheet,
      data: dataArray
    })
  });
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
      {
        id: 'comp-test-1',
        name: 'ООО "Альфа"',
        tax_system: 'USN_6',
        currency: 'RUB',
        is_group: true,
        parent_id: '',
        inn: '7701234567',
        kpp: '770101001',
        external_id: '',
        source: 'manual',
        tenant_id: 'tenant-1',
        created_at: now,
        updated_at: now,
        deleted_at: '',
        is_deleted: '',
        has_employees: true,
        employee_count: 5,
        monthly_payroll: 500000,
        industry_type: 'general',
        is_individual: false
      },
      {
        id: 'comp-test-2',
        name: 'ООО "Бета"',
        tax_system: 'USN_15',
        currency: 'RUB',
        is_group: false,
        parent_id: 'comp-test-1',
        inn: '7707654321',
        kpp: '770101002',
        external_id: '',
        source: 'manual',
        tenant_id: 'tenant-1',
        created_at: now,
        updated_at: now,
        deleted_at: '',
        is_deleted: '',
        has_employees: true,
        employee_count: 3,
        monthly_payroll: 300000,
        industry_type: 'msp_priority',
        is_individual: false
      },
      {
        id: 'comp-test-3',
        name: 'ИП Иванов',
        tax_system: 'USN_6',
        currency: 'RUB',
        is_group: false,
        parent_id: 'comp-test-1',
        inn: '7701112233',
        kpp: '',
        external_id: '',
        source: 'manual',
        tenant_id: 'tenant-1',
        created_at: now,
        updated_at: now,
        deleted_at: '',
        is_deleted: '',
        has_employees: false,
        employee_count: 0,
        monthly_payroll: 0,
        industry_type: 'general',
        is_individual: true
      },
      {
        id: 'comp-test-4',
        name: 'ООО "Гамма"',
        tax_system: 'OSNO',
        currency: 'RUB',
        is_group: false,
        parent_id: 'comp-test-1',
        inn: '7704444444',
        kpp: '770101004',
        external_id: '',
        source: 'manual',
        tenant_id: 'tenant-1',
        created_at: now,
        updated_at: now,
        deleted_at: '',
        is_deleted: '',
        has_employees: true,
        employee_count: 10,
        monthly_payroll: 800000,
        industry_type: 'general',
        is_individual: false
      },
    ];

    // ============================================
    // 2. СЧЕТА
    // ============================================
    const accounts = [
      // ДОХОДЫ
      { id: 'acc-in-revenue', code: 'I-001', name: 'Выручка от продаж', type: 'I', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'ДОХОДЫ', source_code: '90.01', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-in-other', code: 'I-002', name: 'Прочие доходы', type: 'I', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'ДОХОДЫ', source_code: '91.01', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-in-fx', code: 'I-003', name: 'Курсовые разницы (доход)', type: 'I', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'ДОХОДЫ', source_code: '91.01', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // СЕБЕСТОИМОСТЬ
      { id: 'acc-cogs-goods', code: 'C-001', name: 'Закупка товаров', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '41', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cogs-materials', code: 'C-002', name: 'Материалы', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '10', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cogs-logistics', code: 'C-003', name: 'Логистика', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '44', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cogs-packaging', code: 'C-004', name: 'Упаковка', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '44', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cogs-production', code: 'C-005', name: 'Производственные расходы', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '20', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cogs-subcontract', code: 'C-006', name: 'Субподряд', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'СЕБЕСТОИМОСТЬ', source_code: '60', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - Персонал
      { id: 'acc-out-salary', code: 'O-001', name: 'Зарплата', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-personnel', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '70', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-bonus', code: 'O-002', name: 'Премии', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-personnel', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '70', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-training', code: 'O-012', name: 'Обучение', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-personnel', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - Помещения
      { id: 'acc-out-rent-office', code: 'O-003', name: 'Аренда офиса', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-premises', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-rent-warehouse', code: 'O-004', name: 'Аренда склада', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-premises', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-utilities', code: 'O-005', name: 'Коммунальные', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-premises', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - IT и связь
      { id: 'acc-out-internet', code: 'O-006', name: 'Связь и интернет', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-it', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-software', code: 'O-008', name: 'Программное обеспечение', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-it', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-tech', code: 'O-009', name: 'Обслуживание техники', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-it', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - Маркетинг
      { id: 'acc-out-marketing', code: 'O-013', name: 'Реклама', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-marketing', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '44', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-pr', code: 'O-014', name: 'PR и мероприятия', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-marketing', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '44', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - Банк
      { id: 'acc-out-bank-fees', code: 'O-007', name: 'Банковские комиссии', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: 'group-bank', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '91.02', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ОПЕРАЦИОННЫЕ РАСХОДЫ - Прочее
      { id: 'acc-out-other', code: 'O-023', name: 'Прочие операционные', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '26', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // НАЛОГИ И ВЗНОСЫ
      { id: 'acc-tax-insurance', code: 'T-001', name: 'Страховые взносы', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'НАЛОГИ И ВЗНОСЫ', source_code: '69', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-tax-ndfl', code: 'T-002', name: 'НДФЛ', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'НАЛОГИ И ВЗНОСЫ', source_code: '68', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-tax-vat', code: 'T-003', name: 'НДС', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'НАЛОГИ И ВЗНОСЫ', source_code: '68', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-tax-usn', code: 'T-004', name: 'Налог УСН', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'НАЛОГИ И ВЗНОСЫ', source_code: '68', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-tax-profit', code: 'T-005', name: 'Налог на прибыль', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'НАЛОГИ И ВЗНОСЫ', source_code: '68', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // АМОРТИЗАЦИЯ
      { id: 'acc-depreciation-os', code: 'A-001', name: 'Амортизация ОС', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'АМОРТИЗАЦИЯ', source_code: '02', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ФИНАНСОВЫЕ РАСХОДЫ
      { id: 'acc-fin-interest', code: 'F-001', name: 'Проценты по кредитам', type: 'X', is_cash_flow: 'false', activity_type: 'financing', parent_id: '', group_name: 'ФИНАНСОВЫЕ РАСХОДЫ', source_code: '91.02', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ДЕНЕЖНЫЕ СЧЕТА
      { id: 'acc-bank-001', code: 'CA-001', name: 'Альфа-Банк', type: 'A', is_cash_flow: 'true', activity_type: '', parent_id: '', group_name: 'АКТИВЫ', source_code: '51', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-bank-002', code: 'CA-001', name: 'Сбербанк', type: 'A', is_cash_flow: 'true', activity_type: '', parent_id: '', group_name: 'АКТИВЫ', source_code: '51', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-cash-001', code: 'CA-002', name: 'Касса', type: 'A', is_cash_flow: 'true', activity_type: '', parent_id: '', group_name: 'АКТИВЫ', source_code: '50', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ЗАДОЛЖЕННОСТИ
      { id: 'acc-ar-001', code: 'CA-003', name: 'Дебиторская задолженность', type: 'A', is_cash_flow: 'false', activity_type: '', parent_id: '', group_name: 'АКТИВЫ', source_code: '62', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-ap-001', code: 'L-001', name: 'Кредиторская задолженность', type: 'L', is_cash_flow: 'false', activity_type: '', parent_id: '', group_name: 'ОБЯЗАТЕЛЬСТВА', source_code: '60', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // КАПИТАЛ
      { id: 'acc-equity-001', code: 'E-001', name: 'Капитал', type: 'E', is_cash_flow: 'false', activity_type: '', parent_id: '', group_name: 'КАПИТАЛ', source_code: '80', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // НЕРАСПРЕДЕЛЁННОЕ
      { id: 'acc-unclassified', code: 'O-999', name: 'Требует уточнения', type: 'X', is_cash_flow: 'false', activity_type: 'operating', parent_id: '', group_name: 'ОПЕРАЦИОННЫЕ РАСХОДЫ', source_code: '', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // для инвестиционной деятельности
      { id: 'acc-fa-001', code: 'FA-001', name: 'Основные средства', type: 'A', is_cash_flow: 'false', activity_type: 'investing', parent_id: '', group_name: 'АКТИВЫ', source_code: '01', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-capex-001', code: 'CAPEX', name: 'Капитальные затраты', type: 'X', is_cash_flow: 'false', activity_type: 'investing', parent_id: '', group_name: 'ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ
      { id: 'acc-in-invest-sale', code: 'INV-001', name: 'Продажа ОС', type: 'I', is_cash_flow: 'false', activity_type: 'investing', parent_id: '', group_name: 'ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '91.01', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-capex', code: 'INV-002', name: 'Покупка ОС (CAPEX)', type: 'X', is_cash_flow: 'false', activity_type: 'investing', parent_id: '', group_name: 'ИНВЕСТИЦИОННАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '08', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },

      // ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ
      { id: 'acc-in-loan', code: 'FIN-001', name: 'Получение кредитов', type: 'I', is_cash_flow: 'false', activity_type: 'financing', parent_id: '', group_name: 'ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '66', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-loan-principal', code: 'FIN-002', name: 'Погашение тела кредита', type: 'X', is_cash_flow: 'false', activity_type: 'financing', parent_id: '', group_name: 'ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '66', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-loan-interest', code: 'FIN-003', name: 'Проценты по кредитам', type: 'X', is_cash_flow: 'false', activity_type: 'financing', parent_id: '', group_name: 'ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '91.02', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
      { id: 'acc-out-dividends', code: 'FIN-004', name: 'Дивиденды', type: 'X', is_cash_flow: 'false', activity_type: 'financing', parent_id: '', group_name: 'ФИНАНСОВАЯ ДЕЯТЕЛЬНОСТЬ', source_code: '84', is_deleted: '', deleted_at: '', created_at: now, updated_at: now },
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
        vat_rate: 0.22,
        vat_amount: 220000,
        vat_direction: 'outgoing',
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
        vat_rate: 0.22,
        vat_amount: 132000,
        vat_direction: 'incoming',
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

    // Загружаем НЕ-ОСНО операции
    const nonOsnoTransactions = transactions.filter(t => t.company_id !== 'comp-test-4');
    for (let i = 0; i < nonOsnoTransactions.length; i += 5) {
      const chunk = nonOsnoTransactions.slice(i, i + 5);
      await gasBatchCreate('Transactions', chunk);
    }

    // Отдельно загружаем операции ОСНО (меньшими батчами)
    const osnoTransactions = transactions.filter(t => t.company_id === 'comp-test-4');
    for (let i = 0; i < osnoTransactions.length; i += 3) {
      const chunk = osnoTransactions.slice(i, i + 3);
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