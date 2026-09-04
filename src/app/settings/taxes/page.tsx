'use client';

import { useEffect, useState } from 'react';

export default function TaxesSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/data?action=getAll&sheet=Settings', {
        headers: { 'X-DB-URL': JSON.parse(localStorage.getItem('finengine_session') || '{}').dbUrl || '' }
      });
      const data = await response.json();
      setSettings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setLoading(false);
    }
  };

  const taxSettings = settings.filter(s => s.category === 'taxes');
  const limitSettings = settings.filter(s => s.category === 'limits');
  const insuranceSettings = settings.filter(s => s.category === 'insurance');
  const ndflSettings = settings.filter(s => s.category === 'ndfl');
  const ipSettings = settings.filter(s => s.category === 'ip');

  const formatLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      vat_osno: 'НДС ОСНО',
      vat_osno_reduced: 'НДС льготный',
      vat_usn_5: 'НДС УСН 5%',
      vat_usn_7: 'НДС УСН 7%',
      profit_tax: 'Налог на прибыль',
      usn_6: 'УСН Доходы',
      usn_15: 'УСН Доходы-Расходы',
      usn_min_tax: 'Минимальный налог УСН',
      usn_vat_exempt_limit: 'Порог освобождения НДС',
      usn_vat_5_limit: 'Порог 5%',
      usn_vat_7_limit: 'Порог 7%',
      insurance_base_rate: 'Базовая ставка',
      insurance_reduced_rate: 'Пониженная ставка',
      insurance_msp_rate: 'МСП льготная',
      insurance_it_rate: 'IT ставка',
      insurance_limit: 'Предельная база',
      mrot: 'МРОТ',
      ndfl_base_rate: 'НДФЛ базовая',
      ndfl_increased_rate: 'НДФЛ повышенная',
      ndfl_limit: 'Порог НДФЛ',
      ip_fixed: 'Фиксированный взнос',
      ip_additional_rate: 'Доп. взнос %',
      ip_additional_max: 'Макс. доп. взнос',
    };
    return labels[key] || key;
  };

  const formatValue = (setting: any) => {
    const value = parseFloat(setting.value);
    if (setting.key.includes('limit') || setting.key === 'mrot' || setting.key === 'ndfl_limit' || setting.key === 'ip_fixed' || setting.key === 'ip_additional_max') {
      return value.toLocaleString('ru-RU');
    }
    return (value * 100).toFixed(value < 0.1 ? 1 : 0) + '%';
  };

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Налоговые параметры</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Налоговые ставки</h3>
          {taxSettings.map(s => (
            <div key={s.id} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-sm text-gray-600">{formatLabel(s.key)}</span>
              <span className="text-sm font-medium">{formatValue(s)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Лимиты УСН</h3>
          {limitSettings.map(s => (
            <div key={s.id} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-sm text-gray-600">{formatLabel(s.key)}</span>
              <span className="text-sm font-medium">{formatValue(s)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Страховые взносы</h3>
          {insuranceSettings.map(s => (
            <div key={s.id} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-sm text-gray-600">{formatLabel(s.key)}</span>
              <span className="text-sm font-medium">{formatValue(s)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">НДФЛ и ИП</h3>
          {[...ndflSettings, ...ipSettings].map(s => (
            <div key={s.id} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-sm text-gray-600">{formatLabel(s.key)}</span>
              <span className="text-sm font-medium">{formatValue(s)}</span>
            </div>
          ))}
        </div>
      </div>
      
      <p className="text-xs text-gray-400 mt-4">
        Для изменения параметров — редактируйте лист Settings в Google Sheets
      </p>
    </div>
  );
}