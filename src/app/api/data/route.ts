import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const sheet = url.searchParams.get('sheet');
    const id = url.searchParams.get('id');
    const data = url.searchParams.get('data');
    
    // Получаем URL из заголовка
    const dbUrl = request.headers.get('X-DB-URL') || '';
    
    if (!dbUrl) {
      return NextResponse.json(
        { error: 'URL базы данных не указан. Войдите заново.' },
        { status: 400 }
      );
    }
    
    let gasUrl = `${dbUrl}?action=${action}&sheet=${sheet}`;
    if (id) gasUrl += `&id=${encodeURIComponent(id)}`;
    if (data) gasUrl += `&data=${data}`;
    
    console.log('GET к GAS:', gasUrl);
    
    const response = await fetch(gasUrl);
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Ошибка API GET:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;
    const sheet = body.sheet;
    const data = body.data;
    const id = body.id;
    
    const dbUrl = request.headers.get('X-DB-URL') || '';
    
    if (!dbUrl) {
      return NextResponse.json(
        { error: 'URL базы данных не указан. Войдите заново.' },
        { status: 400 }
      );
    }
    
    let gasUrl = `${dbUrl}?action=${action}&sheet=${sheet}`;
    if (id) gasUrl += `&id=${encodeURIComponent(id)}`;
    if (data) gasUrl += `&data=${encodeURIComponent(JSON.stringify(data))}`;
    
    console.log('POST к GAS:', gasUrl);
    
    const response = await fetch(gasUrl);
    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Ошибка API POST:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}