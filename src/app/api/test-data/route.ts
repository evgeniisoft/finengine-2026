import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const created = [];
    
    // Тестовые компании
    const companies = [
      { id: 'comp-test-1', name: 'ООО "Альфа"', tax_system: 'USN_6', currency: 'RUB', is_group: true, parent_id: '' },
      { id: 'comp-test-2', name: 'ООО "Бета"', tax_system: 'USN_15', currency: 'RUB', is_group: false, parent_id: 'comp-test-1' },
      { id: 'comp-test-3', name: 'ИП Иванов', tax_system: 'USN_6', currency: 'RUB', is_group: false, parent_id: 'comp-test-1' },
    ];
    
    for (const company of companies) {
      await api.create('Companies', company);
      created.push(company.id);
    }
    
    // Тестовые операции за 12 месяцев
    const transactions = [];
    let txCounter = 1;
    
    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, '0');
      
      // Каждая компания имеет свою динамику
      const companiesData = [
        { 
          id: 'comp-test-1', 
          revenue: 1000000 + month * 100000, 
          expenses: 600000 + month * 50000 
        },
        { 
          id: 'comp-test-2', 
          revenue: 500000 + month * 50000, 
          expenses: 350000 + month * 30000 
        },
        { 
          id: 'comp-test-3', 
          revenue: 300000 + month * 30000, 
          expenses: 200000 + month * 20000 
        },
      ];
      
      for (const companyData of companiesData) {
        // Доход
        transactions.push({
          date: `2026-${monthStr}-10`,
          company_id: companyData.id,
          description: `Выручка ${monthStr}.2026`,
          amount: companyData.revenue,
          currency: 'RUB',
          type: 'income',
          debit_account_id: 'acc-bank-001',
          credit_account_id: 'acc-rev-001',
          amount_rub: companyData.revenue,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false
        });
        
        // Расход
        transactions.push({
          date: `2026-${monthStr}-20`,
          company_id: companyData.id,
          description: `Расходы ${monthStr}.2026`,
          amount: companyData.expenses,
          currency: 'RUB',
          type: 'expense',
          debit_account_id: 'acc-exp-001',
          credit_account_id: 'acc-bank-001',
          amount_rub: companyData.expenses,
          counterparty_id: '',
          contract_id: '',
          transaction_group_id: '',
          is_system: false
        });
        
        txCounter += 2;
      }
    }
    
    for (const transaction of transactions) {
      await api.create('Transactions', transaction);
      created.push(transaction.company_id);
    }
    
    return NextResponse.json({
      success: true,
      created: transactions.length,
      companies: companies.length
    });
    
  } catch (error) {
    console.error('Ошибка создания тестовых данных:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания тестовых данных' },
      { status: 500 }
    );
  }
}