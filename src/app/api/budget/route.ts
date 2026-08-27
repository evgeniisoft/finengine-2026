import { NextRequest, NextResponse } from 'next/server';
import { budgetEngine } from '@/lib/engine/budget';
import { api } from '@/lib/api';

/**
 * GET /api/budget
 * Получение бюджета с сравнением Факт/План
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('company_id');
    const period = url.searchParams.get('period') || '2026-01';
    
    // Получаем данные
    const [transactions, accounts] = await Promise.all([
      api.getAll('Transactions'),
      api.getAll('Accounts')
    ]);
    
    // Создаём скользящий бюджет
    const budget = budgetEngine.createRollingBudget(
      companyId || 'comp-demo-001',
      period,
      accounts,
      transactions
    );
    
    // Сравниваем с фактом
    const compared = budgetEngine.compareBudgetVsActual(
      budget,
      transactions,
      accounts
    );
    
    return NextResponse.json(compared);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budget
 * Создание бюджета
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const budget = body.budget;
    
    const created = await api.create('Budgets', budget);
    
    return NextResponse.json(created);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}