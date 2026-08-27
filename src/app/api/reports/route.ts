import { NextRequest, NextResponse } from 'next/server';
import { calculator } from '@/lib/engine/calculator';
import { consolidationEngine } from '@/lib/engine/consolidation';
import { api } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'pnl';
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    // Получаем данные
    const [transactions, accounts, companies] = await Promise.all([
      api.getAll('Transactions'),
      api.getAll('Accounts'),
      api.getAll('Companies')
    ]);
    
    console.log('Companies loaded:', companies.length); // Отладка
    
    // Если нет компаний — возвращаем пустой массив
    if (!companies || companies.length === 0) {
      return NextResponse.json([]);
    }
    
    // Выбираем компании
    let targetCompanies = companies;
    if (companyId) {
      targetCompanies = companies.filter(c => c.id === companyId);
    }
    
    console.log('Target companies:', targetCompanies.length); // Отладка
    
    switch (reportType) {
      case 'pnl':
        const pnlReports = targetCompanies.map(company => ({
          company,
          report: calculator.calculatePnL(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          )
        }));
        return NextResponse.json(pnlReports);
        
      case 'cashflow':
        const cashFlowReports = targetCompanies.map(company => ({
          company,
          report: calculator.calculateCashFlow(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          )
        }));
        return NextResponse.json(cashFlowReports);
        
      case 'balance':
        const balanceReports = targetCompanies.map(company => ({
          company,
          report: calculator.calculateBalanceSheet(
            transactions,
            accounts,
            company.id,
            periodEnd
          )
        }));
        return NextResponse.json(balanceReports);
        
      case 'consolidated':
        const consolidated = {
          pnl: consolidationEngine.consolidatePnL(
            targetCompanies,
            transactions,
            accounts,
            periodStart,
            periodEnd
          ),
          cashFlow: consolidationEngine.consolidateCashFlow(
            targetCompanies,
            transactions,
            accounts,
            periodStart,
            periodEnd
          ),
          balance: consolidationEngine.consolidateBalanceSheet(
            targetCompanies,
            transactions,
            accounts,
            periodEnd
          )
        };
        return NextResponse.json(consolidated);
        
      default:
        return NextResponse.json([]);
    }
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера', details: error },
      { status: 500 }
    );
  }
}