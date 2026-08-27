import { NextRequest, NextResponse } from 'next/server';
import { calculator } from '@/lib/engine/calculator';
import { budgetEngine } from '@/lib/engine/budget';
import { forecastEngine } from '@/lib/engine/forecast';
import { consolidationEngine } from '@/lib/engine/consolidation';
import { taxEngine } from '@/lib/engine/tax';
import { api } from '@/lib/api';

/**
 * GET /api/reports
 * Получение всех отчётов для дашборда
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type');
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2025-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2025-12-31';
    
    // Получаем все данные
    const [transactions, accounts, companies] = await Promise.all([
      api.getAll('Transactions'),
      api.getAll('Accounts'),
      api.getAll('Companies')
    ]);
    
    // Выбираем компании (одна или все)
    const targetCompanies = companyId 
      ? companies.filter(c => c.id === companyId)
      : companies;
    
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
        
      case 'taxes':
        const taxReports = targetCompanies.map(company => ({
          company,
          tax: taxEngine.calculateTax(
            company,
            transactions,
            accounts,
            periodStart,
            periodEnd
          )
        }));
        return NextResponse.json(taxReports);
        
      default:
        // Все отчёты сразу
        const allReports = targetCompanies.map(company => ({
          company,
          pnl: calculator.calculatePnL(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          ),
          cashFlow: calculator.calculateCashFlow(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          ),
          balance: calculator.calculateBalanceSheet(
            transactions,
            accounts,
            company.id,
            periodEnd
          ),
          tax: taxEngine.calculateTax(
            company,
            transactions,
            accounts,
            periodStart,
            periodEnd
          )
        }));
        
        return NextResponse.json(allReports);
    }
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}