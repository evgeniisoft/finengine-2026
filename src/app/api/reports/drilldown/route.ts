import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

/**
 * GET /api/reports/drilldown
 * Получение операций по статье за период
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('account_id');
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    const transactions = await api.getAll('Transactions');
    const accounts = await api.getAll('Accounts');
    
    // Фильтруем операции
    const filtered = transactions.filter(t => {
      if (t.date < periodStart || t.date > periodEnd) return false;
      if (companyId && t.company_id !== companyId) return false;
      if (accountId) {
        return t.debit_account_id === accountId || t.credit_account_id === accountId;
      }
      return true;
    });
    
    // Обогащаем данными
    const enriched = filtered.map(t => {
      const debitAccount = accounts.find(a => a.id === t.debit_account_id);
      const creditAccount = accounts.find(a => a.id === t.credit_account_id);
      return {
        ...t,
        debit_account_name: debitAccount?.name || t.debit_account_id,
        credit_account_name: creditAccount?.name || t.credit_account_id,
      };
    });
    
    return NextResponse.json(enriched);
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}