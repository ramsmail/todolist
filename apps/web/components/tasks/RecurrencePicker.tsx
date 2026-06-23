'use client';

import { useState } from 'react';
import { parseRule, serializeRule, describeRule, WD_ORDER, type Weekday, type Freq } from '@todolist/core';

interface Props {
  value:    string | null;
  onChange: (rule: string | null) => void;
}

const PRESETS: Array<{ label: string; value: string }> = [
  { label: 'None',          value: '' },
  { label: 'Every day',     value: 'FREQ=DAILY' },
  { label: 'Every weekday', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly',        value: 'FREQ=WEEKLY' },
  { label: 'Monthly',       value: 'FREQ=MONTHLY' },
  { label: 'Yearly',        value: 'FREQ=YEARLY' },
  { label: 'Custom…',       value: 'CUSTOM' },
];

const WD_LABEL: Record<Weekday, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S', SU: 'S',
};

export function RecurrencePicker({ value, onChange }: Props) {
  const rule = value ? parseRule(value) : null;
  const isPreset = PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState(!isPreset && !!value);

  const select = (v: string) => {
    if (v === 'CUSTOM') { setCustom(true); onChange('FREQ=WEEKLY'); return; }
    setCustom(false);
    onChange(v === '' ? null : v);
  };

  const setFreq = (freq: Freq) => {
    const base = rule ?? { freq: 'weekly' as Freq, interval: 1 };
    onChange(serializeRule({ ...base, freq, byDay: freq === 'weekly' ? base.byDay : undefined }));
  };
  const setInterval = (n: number) => {
    if (!rule || !Number.isFinite(n) || n < 1) return;
    onChange(serializeRule({ ...rule, interval: n }));
  };
  const toggleDay = (d: Weekday) => {
    if (!rule) return;
    const cur = rule.byDay ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    onChange(serializeRule({ ...rule, byDay: WD_ORDER.filter((x) => next.includes(x)) }));
  };

  return (
    <div>
      <select
        aria-label="Repeat"
        value={custom ? 'CUSTOM' : (value ?? '')}
        onChange={(e) => select(e.target.value)}
        className="bg-surface border border-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
      >
        {PRESETS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
      </select>

      {custom && rule && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Every</span>
            <input
              type="number"
              min={1}
              value={rule.interval}
              onChange={(e) => setInterval(parseInt(e.target.value, 10))}
              className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-text-primary text-sm"
              aria-label="Interval"
            />
            <select
              aria-label="Unit"
              value={rule.freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-text-primary text-sm"
            >
              <option value="daily">days</option>
              <option value="weekly">weeks</option>
              <option value="monthly">months</option>
              <option value="yearly">years</option>
            </select>
          </div>

          {rule.freq === 'weekly' && (
            <div className="flex gap-1" role="group" aria-label="Weekdays">
              {WD_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={rule.byDay?.includes(d) ?? false}
                  className={`w-7 h-7 rounded-full text-xs ${
                    rule.byDay?.includes(d) ? 'bg-accent text-white' : 'bg-surface text-text-secondary'
                  }`}
                >
                  {WD_LABEL[d]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {rule && <p className="mt-2 text-xs text-text-muted">{describeRule(rule)}</p>}
    </div>
  );
}
