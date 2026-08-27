'use client';

import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Дашборд' },
    { href: '/companies', label: 'Компании' },
    { href: '/transactions', label: 'Операции' },
    { href: '/reports', label: 'Отчёты' },
    { href: '/settings', label: 'Настройки' },
  ];

  return (
    <nav className="px-4 py-4 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        
        return (
          <a
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-fe-primary text-white'
                : 'text-fe-text-secondary hover:bg-gray-50 hover:text-fe-text'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}