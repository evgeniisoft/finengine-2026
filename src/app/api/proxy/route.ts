import { NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy для обхода CORS
 * Все запросы к Google Apps Script идут через этот прокси
 */

// Получаем URL из переменных окружения
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

/**
 * Обработка POST запросов
 */
export async function POST(request: NextRequest) {
  try {
    if (!GAS_URL) {
      return NextResponse.json(
        { error: 'GAS URL не настроен' },
        { status: 500 }
      );
    }

    // Получаем данные из запроса
    const body = await request.json();
    console.log('Прокси получил запрос:', body);

    // Отправляем запрос в Google Apps Script
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Получаем ответ
    const data = await response.json();
    console.log('Ответ от GAS:', data);

    // Возвращаем ответ клиенту
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ошибка прокси:', error);
    return NextResponse.json(
      { error: 'Ошибка прокси', details: error },
      { status: 500 }
    );
  }
}

/**
 * Обработка GET запросов
 */
export async function GET(request: NextRequest) {
  try {
    if (!GAS_URL) {
      return NextResponse.json(
        { error: 'GAS URL не настроен' },
        { status: 500 }
      );
    }

    // Получаем параметры из URL
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const sheet = url.searchParams.get('sheet');
    const id = url.searchParams.get('id');

    // Формируем URL для GAS
    let gasUrl = `${GAS_URL}?action=${action}&sheet=${sheet}`;
    if (id) {
      gasUrl += `&id=${id}`;
    }

    console.log('Прокси запрос к GAS:', gasUrl);

    // Отправляем запрос в Google Apps Script
    const response = await fetch(gasUrl);
    const data = await response.json();

    // Возвращаем ответ клиенту
    return NextResponse.json(data);
  } catch (error) {
    console.error('Ошибка прокси:', error);
    return NextResponse.json(
      { error: 'Ошибка прокси', details: error },
      { status: 500 }
    );
  }
}