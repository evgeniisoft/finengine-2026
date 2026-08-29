import { NextRequest, NextResponse } from 'next/server';

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
    console.log('Запрос пользователей:', gasUrl);
    
    const response = await fetch(gasUrl);
    const users = await response.json();
    
    if (!Array.isArray(users)) {
      return NextResponse.json({ 
        error: 'Не удалось получить пользователей. Проверьте URL базы данных.' 
      }, { status: 500 });
    }
    
    const user = users.find(u => 
      String(u.email).toLowerCase() === String(email).toLowerCase() && 
      (u.is_active === 'true' || u.is_active === true || u.is_active === 'TRUE')
    );
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден или неактивен' }, { status: 401 });
    }
    
    const userHash = String(user.password_hash || user.password || '');
    
    if (userHash !== passwordHash) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
    }
    
    // Записываем в AuditLog
    try {
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
      console.log('Вход записан в AuditLog');
    } catch (e) {
      console.error('Ошибка записи в AuditLog:', e);
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