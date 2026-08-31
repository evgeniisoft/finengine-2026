import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    // Тестовые компании
    const companies = [
      { id: 'comp-test-1', name: 'ООО "Альфа"', tax_system: 'USN_6', currency: 'RUB', is_group: true, parent_id: '', inn: '7701234567', kpp: '770101001', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      { id: 'comp-test-2', name: 'ООО "Бета"', tax_system: 'USN_15', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7707654321', kpp: '770101002', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
      { id: 'comp-test-3', name: 'ИП Иванов', tax_system: 'USN_6', currency: 'RUB', is_group: false, parent_id: 'comp-test-1', inn: '7701112233', kpp: '', external_id: '', source: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null },
    ];
    
    // Тестовые счета (если не созданы)
    const accounts = [
      { id: 'acc-bank-001', code: 'BANK_ALFA', name: 'Альфа-Банк', type: 'A', is_cash_flow: 'true' },
      { id: 'acc-bank-002', code: 'BANK_SBER', name: 'Сбербанк', type: 'A', is_cash_flow: 'true' },
      { id: 'acc-in-revenue', code: 'IN_REVENUE', name: 'Выручка от клиентов', type: 'I', is_cash_flow: 'false' },
      { id: 'acc-out-salary', code: 'OUT_SALARY', name: 'Зарплата', type: 'X', is_cash_flow: 'false' },
      { id: 'acc-out-rent', code: 'OUT_RENT', name: 'Аренда', type: 'X', is_cash_flow: 'false' },
      { id: 'acc-out-marketing', code: 'OUT_MARKETING', name: 'Маркетинг', type: 'X', is_cash_flow: 'false' },
    ];
    
    // Тестовые операции
    const transactions = [];
    const today = new Date();
    const currentMonth = today.toISOString().substring(0, 7);
    
    // Прошедшие месяцы (январь-август 2026)
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
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // Расход: Зарплата
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
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // Расход: Аренда
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
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // Расход: Маркетинг
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
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    // Будущие операции (для кассовых разрывов)
    // Завтра — большой расход
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
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Через 3 дня — поступление
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
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Через 7 дней — ещё расход (создаст кассовый разрыв)
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
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Массовое создание
    await api.batchCreate('Companies', companies);
    await api.batchCreate('Transactions', transactions);
    
    return NextResponse.json({
      success: true,
      companies: companies.length,
      transactions: transactions.length,
      message: 'Тестовые данные загружены. Включают доходы/расходы за 8 месяцев и будущие операции для проверки кассовых разрывов.'
    });
    
  } catch (error) {
    console.error('Ошибка создания тестовых данных:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}