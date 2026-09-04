import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzdcT2cZO5ynSBVMWakir1Y5aAaf5MJaqRq1C8zXDrECdaLbtT_yw3idz7FUNjpMShriw/exec';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { check_id, action, data } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Не указано действие' }, { status: 400 });
    }

    switch (action) {
      case 'delete_duplicates': {
        // Удаляем дубликаты по import_hash
        const hashes = data || [];
        let deleted = 0;
        
        for (const hash of hashes) {
          const deleteUrl = `${GAS_URL}?action=deleteByHash&sheet=Transactions&hash=${encodeURIComponent(hash)}`;
          const response = await fetch(deleteUrl);
          const result = await response.json();
          if (result.success) {
            deleted++;
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Удалено ${deleted} дубликатов`
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