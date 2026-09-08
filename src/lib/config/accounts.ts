/**
 * ============================================
 * FinEngine 2026 - Конфигурация системных счетов
 * ============================================
 */

let systemAccounts: {
  bank: string;
  ar: string;
  ap: string;
  equity: string;
  unclassified: string;
  fixed_assets: string;
  revenue: string;
} = {
  bank: 'acc-bank-001',
  ar: 'acc-ar-001',
  ap: 'acc-ap-001',
  equity: 'acc-equity-001',
  unclassified: 'acc-unclassified',
  fixed_assets: 'acc-fa-001',
  revenue: 'acc-in-revenue',
};

export function loadSystemAccounts(settings: any[]) {
  const settingsMap: any = {};
  settings.forEach(s => {
    settingsMap[s.key] = s.value;
  });

  systemAccounts = {
    bank: settingsMap['system_account_bank'] || systemAccounts.bank,
    ar: settingsMap['system_account_ar'] || systemAccounts.ar,
    ap: settingsMap['system_account_ap'] || systemAccounts.ap,
    equity: settingsMap['system_account_equity'] || systemAccounts.equity,
    unclassified: settingsMap['system_account_unclassified'] || systemAccounts.unclassified,
    fixed_assets: settingsMap['system_account_fixed_assets'] || systemAccounts.fixed_assets,
    revenue: settingsMap['system_account_revenue'] || systemAccounts.revenue,
  };
}

export function getSystemAccount(key: keyof typeof systemAccounts): string {
  return systemAccounts[key];
}

export function getSystemAccounts() {
  return systemAccounts;
}