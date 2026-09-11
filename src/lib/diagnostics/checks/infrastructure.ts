/**
 * ============================================
 * Уровень 6: Инфраструктура
 * ============================================
 */

import { DiagnosticContext, DiagnosticCheck } from '../types';
import { okCheck, problemCheck } from '../engine';

const LEVEL = 6 as const;
const CATEGORY = 'infrastructure' as const;

export async function runInfrastructureChecks(ctx: DiagnosticContext): Promise<DiagnosticCheck[]> {
    const checks: DiagnosticCheck[] = [];

    // 6.1 Скорость GAS
    checks.push(checkGasSpeed(ctx));

    // 6.2 Лимиты GAS
    checks.push(checkGasQuota(ctx));

    // 6.3 Кэш
    checks.push(checkCacheSetup(ctx));

    // 6.4 Автофиксы
    checks.push(checkAutoFixSupport(ctx));

    return checks;
}

// ============================================
// 6.1 Скорость GAS
// ============================================
function checkGasSpeed(ctx: DiagnosticContext): DiagnosticCheck {
    const loadMs = ctx.gasLoadTime;
    const seconds = (loadMs / 1000).toFixed(2);

    if (loadMs > 5000) {
        return problemCheck(
            'gas_speed', LEVEL, CATEGORY, 'critical',
            'Скорость загрузки данных',
            `Загрузка всех данных: ${seconds} сек (критично)`,
            {
                details: { load_time_ms: loadMs },
                reason: 'Загрузка >5 секунд',
                recommendation: 'Оптимизируйте GAS-скрипт, уменьшите объём данных',
                display: {
                    type: 'key_value',
                    items: [
                        { label: 'Время загрузки', value: `${seconds} сек`, color: 'red', bold: true },
                        { label: 'Порог критичный', value: '5.00 сек' },
                        { label: 'Порог предупреждения', value: '2.00 сек' },
                    ],
                },
            }
        );
    }

    if (loadMs > 2000) {
        return problemCheck(
            'gas_speed', LEVEL, CATEGORY, 'warning',
            'Скорость загрузки данных',
            `Загрузка всех данных: ${seconds} сек`,
            {
                details: { load_time_ms: loadMs },
                recommendation: 'Проверьте объём данных',
                display: {
                    type: 'key_value',
                    items: [
                        { label: 'Время загрузки', value: `${seconds} сек`, color: 'yellow', bold: true },
                    ],
                },
            }
        );
    }

    return okCheck(
        'gas_speed', LEVEL, CATEGORY,
        'Скорость загрузки данных',
        `Загрузка: ${seconds} сек`,
        {
            display: {
                type: 'key_value',
                items: [
                    { label: 'Время загрузки', value: `${seconds} сек`, color: 'green', bold: true },
                ],
            },
        }
    );
}

// ============================================
// 6.2 Лимиты GAS
// ============================================
function checkGasQuota(ctx: DiagnosticContext): DiagnosticCheck {
    const totalRows =
        ctx.transactions.length +
        ctx.accounts.length +
        ctx.companies.length +
        ctx.counterparties.length +
        ctx.budgets.length;

    const estimatedQuota = totalRows * 0.5;
    const quotaLimit = 100000;
    const usagePercent = (estimatedQuota / quotaLimit) * 100;

    if (usagePercent > 80) {
        return problemCheck(
            'gas_quota', LEVEL, CATEGORY, 'warning',
            'Лимиты GAS',
            `Использовано ~${estimatedQuota.toLocaleString('ru-RU')} из ${quotaLimit.toLocaleString('ru-RU')} операций (${usagePercent.toFixed(1)}%)`,
            {
                details: { total_rows: totalRows, estimated_operations: estimatedQuota, daily_limit: quotaLimit, usage_percent: usagePercent },
                recommendation: 'Рассмотрите переход на PostgreSQL',
                display: {
                    type: 'progress_bar',
                    title: 'Лимит GAS',
                    percent: usagePercent,
                    threshold: quotaLimit,
                    threshold_label: 'Дневной лимит',
                },
            }
        );
    }

    return okCheck(
        'gas_quota', LEVEL, CATEGORY,
        'Лимиты GAS',
        `Использовано ~${estimatedQuota.toLocaleString('ru-RU')} (${usagePercent.toFixed(1)}%)`,
        {
            display: {
                type: 'progress_bar',
                title: 'Лимит GAS',
                percent: usagePercent,
                threshold: quotaLimit,
                threshold_label: 'Дневной лимит',
            },
        }
    );
}

// ============================================
// 6.3 Кэш
// ============================================
function checkCacheSetup(ctx: DiagnosticContext): DiagnosticCheck {
    // Проверка: если CRUD был недавно, кэш должен быть инвалидирован.
    // В текущей архитектуре это невозможно проверить безопасно.
    // Просто напоминаем о необходимости проверки.

    const hasCacheWarnings: string[] = [];

    // Проверяем, что API отчётов не кэширует дольше 300 секунд
    // (это статическая проверка — по факту нужна метрика)

    // Заглушка: предполагаем, что кэш не инвалидируется (это известная проблема)
    hasCacheWarnings.push('Кэш /api/reports не инвалидируется при CRUD');

    return problemCheck(
        'cache_invalidation', LEVEL, CATEGORY, 'warning',
        'Инвалидация кэша',
        'Кэш отчётов не инвалидируется при изменении данных',
        {
            details: { warnings: hasCacheWarnings },
            reason: 'В /api/reports кэш 5 минут, нет вызова invalidate',
            recommendation: 'Инвалидировать CACHE_PREFIXES.REPORTS при CRUD',
            display: {
                type: 'list',
                items: hasCacheWarnings.map(w => ({
                    label: 'Проблема',
                    value: w,
                    color: 'yellow' as const,
                })),
            },
        }
    );
}

// ============================================
// 6.4 Автофиксы
// ============================================
function checkAutoFixSupport(ctx: DiagnosticContext): DiagnosticCheck {
    // Проверяем, какие автофиксы поддерживаются GAS
    const supportedActions: string[] = [
        'create_missing_account',
        'categorize_unclassified',
        'fix_future_dates',
        'fill_empty_budgets',
    ];

    const unsupportedActions: string[] = [
        // delete_duplicates теперь поддерживается (delete по id)
    ];

    if (unsupportedActions.length === 0) {
        return okCheck('autofix_support', LEVEL, CATEGORY, 'Автофиксы', 'Все автофиксы поддерживаются');
    }

    return problemCheck(
        'autofix_support', LEVEL, CATEGORY, 'warning',
        'Автофиксы',
        `${unsupportedActions.length} автофикс не поддерживается GAS`,
        {
            details: {
                supported: supportedActions,
                unsupported: unsupportedActions,
            },
            reason: 'delete_duplicates требует deleteByHash, которого нет в GAS',
            recommendation: 'Переписать delete_duplicates на delete по id',
            display: {
                type: 'list',
                items: unsupportedActions.map(a => ({
                    label: a,
                    value: 'не поддерживается',
                    color: 'yellow' as const,
                })),
            },
        }
    );
}