import { NextRequest, NextResponse } from 'next/server';

// Храним URL временно (для тестового входа)
let tempDbUrl = '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dbUrl, email, passwordHash } = body;
    
    if (!dbUrl) {
      return NextResponse.json({ error: 'Не указан URL базы данных' }, { status: 400 });
    }
    
    if (!email || !passwordHash) {
      return NextResponse.json({ error: 'Введите email и пароль' }, { status: 400 });
    }
    
    // Сохраняем URL для последующих запросов
    tempDbUrl = dbUrl;
    
    // Запрашиваем пользователей из базы
    const gasUrl = `${dbUrl}?action=getAll&sheet=Users`;
    console.log('Запрос к GAS:', gasUrl);
    
    const response = await fetch(gasUrl);
    const users = await response.json();
    
    console.log('Пользователи:', users);
    
    if (!Array.isArray(users)) {
      return NextResponse.json({ error: 'Не удалось получить пользователей. Проверьте URL.' }, { status: 500 });
    }
    
    // Ищем пользователя
    const user = users.find(u => 
      String(u.email).toLowerCase() === String(email).toLowerCase() && 
      (u.is_active === 'true' || u.is_active === true || u.is_active === 'TRUE')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден или неактивен' }, { status: 401 });
    }
    
    // Проверяем пароль
    const userHash = String(user.password_hash || user.password || '');
    console.log('Хеш в базе:', userHash);
    console.log('Хеш из формы:', passwordHash);
    
    if (userHash !== passwordHash) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || email,
        role: user.role || 'viewer',
        company_id: user.company_id || ''
      }
    });
    
  } catch (error) {
    console.error('Ошибка входа:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка: ' + (error as Error).message }, { status: 500 });
  }
}