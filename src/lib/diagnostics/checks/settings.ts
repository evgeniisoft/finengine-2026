/**
 * ============================================
 * Уровень 2: Настройки
 * ============================================
 */

import { DiagnosticContext, DiagnosticCheck } from '../types';
import { okCheck, problemCheck } from '../engine';
import { getSystemAccount } from '@/lib/config/accounts';

const LEVEL = 2 as const;
const CATEGORY = 'settings' as const;

const REQUIRED_KEYS = [
  'usn_6', 'usn_15', 'usn_min_tax',
  'profit_tax', 'vat_osno',
  'insurance_base_rate', 'insurance_limit', 'insurance_reduced_rate',
  'insurance_msp_rate', 'insurance_it_rate',
  'ndfl_base_rate', 'ndfl_limit', 'ndfl_increased_rate',
  'ip_fixed_contribution', 'ip_additional_threshold', 'ip_additional_rate', 'ip_additional_max',
  'usn_vat_exempt_limit', 'usn_vat_5_limit', 'usn_vat_7_limit',
  'vat_usn_5', 'vat_usn_7',
  'mrot',
];

const RANGE_VALIDATORS: Record<string, { min: number; max: number; name: string }> = {
  usn_6: { min: 0, max: 0.15, name: 'УСН 6%' },
  usn_15: { min: 0, max: 0.30, name: 'УСН 15%' },
  usn_min_tax: { min: 0, max: 0.05, name: 'Минимальный налог УСН' },
  profit_tax: { min: 0, max: 0.5, name: 'Налог на прибыль' },
  vat_osno: { min: 0, max: 0.5, name: 'НДС ОСНО' },
  vat_usn_5: { min: 0, max: 0.15, name: 'НДС УСН 5%' },
  vat_usn_7: { min: 0, max: 0.15, name: 'НДС УСН 7%' },
  insurance_base_rate: { min: 0, max: 0.5, name: 'Базовая ставка взносов' },
  insurance_reduced_rate: { min: 0, max: 0.5, name: 'Пониженная ставка взносов' },
  insurance_msp_rate: { min: 0, max: 0.5, name: 'Ставка МСП' },
  insurance_it_rate: { min: 0, max: 0.5, name: 'Ставка IT' },
  ndfl_base_rate: { min: 0, max: 0.3, name: 'НДФЛ базовая' },
  ndfl_increased_rate: { min: 0, max: 0.3, name: 'НДФЛ повышенная' },
  ip_additional_rate: { min: 0, max: 0.05, name: 'Доп. взнос ИП' },
};

export async function runSettingsChecks(ctx: DiagnosticContext): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];

  // 2.1 Полнота настроек
  checks.push(checkRequiredKeys(ctx));

  // 2.2 Валидность значений
  checks.push(...checkValueRanges(ctx));

  // 2.3 Системные счета
  checks.push(checkSystemAccounts(ctx));

  // 2.4 Согласованность порогов НДС УСН
  checks.push(checkVatThresholds(ctx));

  return checks;
}

// ============================================
// 2.1 Полнота настроек
// ============================================
function checkRequiredKeys(ctx: DiagnosticContext): DiagnosticCheck {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (ctx.settings[key] === undefined || ctx.settings[key] === '') {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    return okCheck('settings_required_keys', LEVEL, CATEGORY, 'Полнота настроек', `Все ${REQUIRED_KEYS.length} ключей заданы`);
  }

  return problemCheck(
    'settings_required_keys', LEVEL, CATEGORY, 'warning',
    'Полнота настроек',
    `Отсутствуют ${missing.length} ключей из ${REQUIRED_KEYS.length}`,
    {
      count: missing.length,
      details: { missing },
      reason: 'Настройки не заданы, используются дефолты из кода',
      recommendation: 'Задайте значения в Settings',
      display: {
        type: 'list',
        items: missing.slice(0, 10).map(k => ({ label: k, value: 'не задано', color: 'yellow' as const })),
      },
    }
  );
}

// ============================================
// 2.2 Валидность значений
// ============================================
function checkValueRanges(ctx: DiagnosticContext): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  const invalid: { key: string; value: any; valid_range: string }[] = [];

  for (const [key, validator] of Object.entries(RANGE_VALIDATORS)) {
    const raw = ctx.settings[key];
    if (raw === undefined || raw === '') continue;
    const val = parseFloat(String(raw));
    if (isNaN(val) || val < validator.min || val > validator.max) {
      invalid.push({
        key,
        value: raw,
        valid_range: `[${validator.min}, ${validator.max}]`,
      });
    }
  }

  if (invalid.length === 0) {
    checks.push(okCheck('settings_value_ranges', LEVEL, CATEGORY, 'Валидность значений', 'Все ставки в допустимых диапазонах'));
  } else {
    checks.push(problemCheck(
      'settings_value_ranges', LEVEL, CATEGORY, 'critical',
      'Валидность значений',
      `${invalid.length} настроек вне допустимого диапазона`,
      {
        count: invalid.length,
        details: { invalid },
        reason: 'Ставка вне допустимого диапазона',
        recommendation: 'Исправьте значения в Settings',
        display: {
          type: 'list',
          items: invalid.slice(0, 5).map(i => ({
            label: `${i.key} = ${i.value}`,
            value: `допустимо ${i.valid_range}`,
            color: 'red' as const,
          })),
        },
      }
    ));
  }

  return checks;
}

// ============================================
// 2.3 Системные счета
// ============================================
function checkSystemAccounts(ctx: DiagnosticContext): DiagnosticCheck {
  const accountIds = new Set(ctx.accounts.map(a => a.id));
  const systemKeys = ['bank', 'ar', 'ap', 'equity', 'unclassified', 'fixed_assets', 'revenue'] as const;
  const missing: { key: string; account_id: string }[] = [];

  for (const key of systemKeys) {
    const accId = getSystemAccount(key);
    if (!accId || !accountIds.has(accId)) {
      missing.push({ key, account_id: accId || '—' });
    }
  }

  if (missing.length === 0) {
    return okCheck('settings_system_accounts', LEVEL, CATEGORY, 'Системные счета', `Все ${systemKeys.length} системных счетов существуют`);
  }

  return problemCheck(
    'settings_system_accounts', LEVEL, CATEGORY, 'critical',
    'Системные счета',
    `${missing.length} системных счетов не найдены в справочнике`,
    {
      count: missing.length,
      details: { missing },
      reason: 'Системный счёт ссылается на несуществующий ID',
      recommendation: 'Исправьте настройки или создайте счета',
      auto_fix: true,
      auto_fix_action: 'create_missing_account',
      auto_fix_data: missing.map(m => m.account_id).filter(id => id !== '—'),
      auto_fix_info: {
        title: 'Создать недостающие счета',
        description: 'Будут созданы счета, указанные в настройках',
        impact: 'Счета появятся в справочнике',
        risk: 'Низкий риск',
      },
      display: {
        type: 'list',
        items: missing.map(m => ({ label: m.key, value: m.account_id, color: 'red' as const })),
      },
    }
  );
}

// ============================================
// 2.4 Согласованность порогов НДС УСН
// ============================================
function checkVatThresholds(ctx: DiagnosticContext): DiagnosticCheck {
  const exempt = parseFloat(String(ctx.settings['usn_vat_exempt_limit'] || '20000000'));
  const rate5 = parseFloat(String(ctx.settings['usn_vat_5_limit'] || '250000000'));
  const rate7 = parseFloat(String(ctx.settings['usn_vat_7_limit'] || '490500000'));

  if (!(exempt < rate5 && rate5 < rate7)) {
    return problemCheck(
      'settings_vat_thresholds', LEVEL, CATEGORY, 'critical',
      'Пороги НДС УСН',
      'Пороги не упорядочены: exempt < rate5 < rate7',
      {
        details: { exempt, rate5, rate7 },
        reason: 'Пороги должны возрастать',
        recommendation: 'Исправьте настройки',
        display: {
          type: 'key_value',
          items: [
            { label: 'Льготный', value: exempt.toLocaleString('ru-RU') },
            { label: 'НДС 5%', value: rate5.toLocaleString('ru-RU') },
            { label: 'НДС 7%', value: rate7.toLocaleString('ru-RU') },
          ],
        },
      }
    );
  }

  return okCheck('settings_vat_thresholds', LEVEL, CATEGORY, 'Пороги НДС УСН', 'Пороги корректны');
}