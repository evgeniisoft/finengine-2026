import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/login
 * Вход пользователя
 */
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
    
    // Запрашиваем пользователей из базы
    const gasUrl = `${dbUrl}?action=getAll&sheet=Users`;
    const response = await fetch(gasUrl);
    const users = await response.json();
    
    if (!Array.isArray(users)) {
      return NextResponse.json({ error: 'Не удалось получить пользователей' }, { status: 500 });
    }
    
    // Ищем пользователя по email
    const user = users.find(u => 
      u.email === email && 
      (u.is_active === 'true' || u.is_active === true || u.is_active === 'TRUE')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден или неактивен' }, { status: 401 });
    }
    
    // Проверяем пароль
    if (user.password_hash !== passwordHash) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
    }
    
    // Обновляем last_login
    const updateUrl = `${dbUrl}?action=update&sheet=Users&id=${encodeURIComponent(user.id)}&data=${encodeURIComponent(JSON.stringify({
      ...user,
      last_login: new Date().toISOString()
    }))}`;
    await fetch(updateUrl);
    
    // Записываем в AuditLog
    const auditData = {
      user_id: user.id,
      user_email: user.email,
      action: 'login',
      entity: '',
      entity_id: '',
      changes: '',
      timestamp: new Date().toISOString()
    };
    const auditUrl = `${dbUrl}?action=create&sheet=AuditLog&data=${encodeURIComponent(JSON.stringify(auditData))}`;
    await fetch(auditUrl);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id || ''
      }
    });
    
  } catch (error) {
    console.error('Ошибка входа:', error);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }
}