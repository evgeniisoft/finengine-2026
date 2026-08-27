import { NextRequest, NextResponse } from 'next/server';
import { calculator } from '@/lib/engine/calculator';
import { api } from '@/lib/api';

/**
 * GET: Получение операций с расчётами
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    if (action === 'reports') {
      // Получаем все данные
      const [transactions, accounts, companies] = await Promise.all([
        api.getAll('Transactions'),
        api.getAll('Accounts'),
        api.getAll('Companies')
      ]);
      
      // Рассчитываем отчёты для каждой компании
      const reports = companies.map(company => {
        const pnl = calculator.calculatePnL(
          transactions,
          accounts,
          company.id,
          '2025-01-01',
          '2025-12-31'
        );
        
        const cashFlow = calculator.calculateCashFlow(
          transactions,
          accounts,
          company.id,
          '2025-01-01',
          '2025-12-31'
        );
        
        const balance = calculator.calculateBalanceSheet(
          transactions,
          accounts,
          company.id,
          '2025-12-31'
        );
        
        return {
          company,
          pnl,
          cashFlow,
          balance
        };
      });
      
      return NextResponse.json(reports);
    }
    
    // По умолчанию — просто операции
    const data = await api.getAll('Transactions');
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * POST: Создание операции с автоматической проводкой
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transaction = body.transaction;
    
    // Создаём операцию
    const created = await api.create('Transactions', transaction);
    
    // Создаём проводки (двойная запись)
    const entries = calculator.createJournalEntries(transaction);
    
    // Сохраняем проводки
    for (const entry of entries) {
      await api.create('JournalEntries', entry);
    }
    
    return NextResponse.json({ transaction: created, entries });
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}