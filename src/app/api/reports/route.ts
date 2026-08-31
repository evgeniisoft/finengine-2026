import { NextRequest, NextResponse } from 'next/server';
import { calculator } from '@/lib/engine/calculator';
import { consolidationEngine } from '@/lib/engine/consolidation';
import { taxEngine } from '@/lib/engine/tax';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

async function gasGet(sheet: string): Promise<any[]> {
  const url = `${GAS_URL}?action=getAll&sheet=${sheet}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get('type') || 'pnl';
    const companyId = url.searchParams.get('company_id');
    const periodStart = url.searchParams.get('period_start') || '2026-01-01';
    const periodEnd = url.searchParams.get('period_end') || '2026-12-31';
    
    const [transactions, accounts, companies] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Accounts'),
      gasGet('Companies')
    ]);
    
    console.log('Transactions:', transactions.length);
    console.log('Accounts:', accounts.length);
    console.log('Companies:', companies.length);
    
    if (!companies || companies.length === 0) {
      return NextResponse.json([]);
    }
    
    let targetCompanies = companies;
    if (companyId) {
      targetCompanies = companies.filter(c => c.id === companyId);
    }
    
    switch (reportType) {
      case 'pnl': {
        const reports = targetCompanies.map(company => ({
          company,
          report: calculator.calculatePnL(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          )
        }));
        return NextResponse.json(reports);
      }
      
      case 'cashflow': {
        const reports = targetCompanies.map(company => ({
          company,
          report: calculator.calculateCashFlow(
            transactions,
            accounts,
            company.id,
            periodStart,
            periodEnd
          )
        }));
        return NextResponse.json(reports);
      }
      
      case 'balance': {
        const reports = targetCompanies.map(company => ({
          company,
          report: calculator.calculateBalanceSheet(
            transactions,
            accounts,
            company.id,
            periodEnd
          )
        }));
        return NextResponse.json(reports);
      }
      
      case 'consolidated': {
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
      }
      
      case 'transactions': {
        return NextResponse.json(transactions);
      }
      
      default: {
        return NextResponse.json([]);
      }
    }
    
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}