import { NextRequest, NextResponse } from 'next/server';

/**
 * ============================================
 * FinEngine 2026 - Единая точка входа для данных
 * ============================================
 * Все запросы из React идут через этот API Route.
 * Здесь решается, какая база данных используется.
 */

// Активный URL GAS (устанавливается через интерфейс)
let activeGasUrl: string = '';

/**
 * GET запросы: getAll, getById, delete
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const sheet = url.searchParams.get('sheet');
    const id = url.searchParams.get('id');
    const data = url.searchParams.get('data');
    
    if (!activeGasUrl) {
      return NextResponse.json(
        { error: 'URL API не настроен. Укажите его в Настройках → База данных.' },
        { status: 400 }
      );
    }
    
    // Формируем URL для GAS
    let gasUrl = `${activeGasUrl}?action=${action}&sheet=${sheet}`;
    if (id) gasUrl += `&id=${encodeURIComponent(id)}`;
    if (data) gasUrl += `&data=${data}`;
    
    console.log('GET к GAS:', gasUrl);
    
    const response = await fetch(gasUrl);
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Ошибка API GET:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

/**
 * POST запросы: create, update, batchCreate, set_url
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;
    
    // Специальное действие: установка URL
    if (action === 'set_url') {
      activeGasUrl = body.url;
      console.log('URL API установлен:', activeGasUrl);
      return NextResponse.json({ success: true, url: activeGasUrl });
    }
    
    // Специальное действие: получение текущего URL
    if (action === 'get_url') {
      return NextResponse.json({ url: activeGasUrl });
    }
    
    if (!activeGasUrl) {
      return NextResponse.json(
        { error: 'URL API не настроен. Укажите его в Настройках → База данных.' },
        { status: 400 }
      );
    }
    
    // Формируем запрос к GAS
    const sheet = body.sheet;
    const data = body.data;
    
    let gasUrl = `${activeGasUrl}?action=${action}&sheet=${sheet}`;
    
    if (body.id) gasUrl += `&id=${encodeURIComponent(body.id)}`;
    if (data) gasUrl += `&data=${encodeURIComponent(JSON.stringify(data))}`;
    
    console.log('POST к GAS:', gasUrl);
    
    const response = await fetch(gasUrl);
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Ошибка API POST:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}