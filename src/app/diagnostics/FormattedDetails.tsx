'use client';

import { DiagnosticDisplay } from '@/lib/diagnostics/types';
import { formatCurrency, formatPercent } from '@/lib/diagnostics/formatters';

export default function FormattedDetails({ display }: { display: DiagnosticDisplay | undefined }) {
  if (!display) return null;

  switch (display.type) {
    case 'progress_bar':
      return (
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-700">{display.title}</span>
            <span className="font-medium">{formatPercent(display.percent || 0)}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                (display.percent || 0) > 80 ? 'bg-red-500' : 
                (display.percent || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(display.percent || 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>Порог: {display.threshold ? formatCurrency(display.threshold) : '—'}</span>
            <span>{display.threshold_label}</span>
          </div>
        </div>
      );

    case 'key_value':
      return (
        <div className="space-y-2">
          {display.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-500">{item.label}</span>
              <span className={`font-medium ${
                item.color === 'red' ? 'text-red-600' :
                item.color === 'yellow' ? 'text-yellow-600' :
                item.color === 'green' ? 'text-green-600' :
                'text-gray-900'
              } ${item.bold ? 'font-bold' : ''}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="space-y-1">
          {display.items?.map((item, idx) => (
            <div key={idx} className="text-sm text-gray-700">
              <span className="text-gray-400 mr-2">•</span>
              <span className="text-gray-600">{item.label}:</span>{' '}
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      );

    case 'status':
      const statusColor = display.items?.[0]?.color || 'gray';
      return (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          statusColor === 'red' ? 'bg-red-50 text-red-700' :
          statusColor === 'yellow' ? 'bg-yellow-50 text-yellow-700' :
          statusColor === 'green' ? 'bg-green-50 text-green-700' :
          'bg-gray-50 text-gray-700'
        }`}>
          {display.items?.[0]?.value || display.title}
        </div>
      );

    case 'text':
    default:
      return <p className="text-sm text-gray-600">{display.title}</p>;
  }
}