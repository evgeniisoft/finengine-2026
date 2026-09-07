import { NextRequest, NextResponse } from 'next/server';
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
    const [transactions, companies, settings] = await Promise.all([
      gasGet('Transactions'),
      gasGet('Companies'),
      gasGet('Settings')
    ]);

    await taxEngine.loadSettings(settings);

    const usnCompanies = companies.filter(c => 
      c.tax_system === 'USN_6' || c.tax_system === 'USN_15'
    );

    const limits = usnCompanies.map(company => {
      const limitInfo = taxEngine.checkUSNLimits(company, transactions);
      return {
        company_id: company.id,
        company_name: company.name,
        tax_system: company.tax_system,
        ...limitInfo
      };
    });

    return NextResponse.json(limits);
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json([]);
  }
}