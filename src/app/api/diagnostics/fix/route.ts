import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/dal/repository';

export async function POST(request: NextRequest) {
  try {
    const repo = getRepository();
    const body = await request.json();
    const { check_id, action, data } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Не указано действие' }, { status: 400 });
    }

    switch (action) {
      case 'delete_duplicates': {
        const hashes = data || [];
        let deleted = 0;
        
        for (const hash of hashes) {
          const result = await repo.deleteByHash('Transactions', hash);
          if (result.success) {
            deleted++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Удалено ${deleted} дубликатов`
        });
      }

      case 'create_missing_account': {
        const missingAccounts = data || [];
        const existingAccounts = await repo.getAll('Accounts');
        let created = 0;
        
        for (const accId of missingAccounts) {
          // Проверяем, что счёт ещё не существует
          if (existingAccounts.some(a => a.id === accId)) continue;
          
          // Определяем тип счёта по префиксу
          let type = 'A';
          let name = 'Счёт';
          
          if (accId.startsWith('acc-in-')) {
            type = 'I';
            name = 'Доход';
          } else if (accId.startsWith('acc-out-rent')) {
            type = 'X';
            name = 'Аренда';
          } else if (accId.startsWith('acc-out-')) {
            type = 'X';
            name = 'Расход';
          } else if (accId.startsWith('acc-bank-')) {
            type = 'A';
            name = 'Банк';
          }
          
          const newAccount = {
            id: accId,
            code: accId.replace('acc-', '').toUpperCase(),
            name,
            type,
            is_cash_flow: accId.startsWith('acc-bank-') ? true : false,
            parent_id: ''
          };
          
          const result = await repo.create('Accounts', newAccount);
          if (result.success || !result.error) {
            created++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Создано ${created} счетов`
        });
      }

      case 'categorize_unclassified': {
        const txIds = data || [];
        let updated = 0;
        
        for (const txId of txIds) {
          const updateData = {
            debit_account_id: 'acc-out-other',
            credit_account_id: 'acc-bank-001'
          };
          
          const result = await repo.update('Transactions', txId, updateData);
          if (result.success || !result.error) {
            updated++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Категоризировано ${updated} операций`
        });
      }

      case 'fix_future_dates': {
        const txIds = data || [];
        const today = new Date().toISOString().split('T')[0];
        let updated = 0;
        
        for (const txId of txIds) {
          const result = await repo.update('Transactions', txId, { date: today });
          if (result.success || !result.error) {
            updated++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Исправлено ${updated} дат`
        });
      }

      case 'fill_empty_budgets': {
        const budgetIds = data || [];
        let updated = 0;
        
        for (const budgetId of budgetIds) {
          const result = await repo.update('Budgets', budgetId, { planned_amount: 0, status: 'draft' });
          if (result.success || !result.error) {
            updated++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Заполнено ${updated} статей бюджета`
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
    }
  } catch (error) {
    console.error('Ошибка автоисправления:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка: ' + (error as Error).message },
      { status: 500 }
    );
  }
}