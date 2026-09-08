/**
 * ============================================
 * FinEngine 2026 - Конфигурация системных счетов
 * ============================================
 * Счета загружаются из Settings, не зашиты в коде
 */

let systemAccounts: {
  bank: string;
  ar: string;
  ap: string;
  equity: string;
  unclassified: string;
} = {
  bank: 'acc-bank-001',
  ar: 'acc-ar-001',
  ap: 'acc-ap-001',
  equity: 'acc-equity-001',
  unclassified: 'acc-unclassified',
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
  };
}

export function getSystemAccount(key: keyof typeof systemAccounts): string {
  return systemAccounts[key];
}

export function getSystemAccounts() {
  return systemAccounts;
}