'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string | null;
  onChange: (date: string | null) => void;
}

export function DatePicker({ value, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    value ? new Date(value + 'T00:00:00') : new Date()
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const calendarDays: (number | null)[] = [];
  const firstDay = getFirstDayOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const handleDateClick = (day: number) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = selected.toISOString().split('T')[0];
    onChange(dateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isClickOnButton = buttonRef.current?.contains(target);
      const isClickOnDropdown = dropdownRef.current?.contains(target);

      if (!isClickOnButton && !isClickOnDropdown) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div ref={containerRef} className="w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-left flex items-center justify-between"
      >
        <span>{displayValue || 'Select date'}</span>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed bg-surface border border-border rounded-xl shadow-lg p-4 z-50 min-w-[320px]"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${Math.max(8, dropdownPos.left)}px`,
            right: '8px',
          }}
        >
          <div className="space-y-3">
            {/* Month/Year Header */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-surface-alt rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-text-primary">{monthYear}</h3>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-surface-alt rounded-lg transition-colors"
                aria-label="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-xs font-semibold text-text-muted py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const isSelected = day && value
                  ? new Date(value + 'T00:00:00').getDate() === day &&
                    new Date(value + 'T00:00:00').getMonth() === currentMonth.getMonth() &&
                    new Date(value + 'T00:00:00').getFullYear() === currentMonth.getFullYear()
                  : false;

                const isToday = day
                  ? new Date().getDate() === day &&
                    new Date().getMonth() === currentMonth.getMonth() &&
                    new Date().getFullYear() === currentMonth.getFullYear()
                  : false;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => day && handleDateClick(day)}
                    disabled={!day}
                    className={`
                      py-1.5 text-xs font-medium rounded-lg transition-colors
                      ${!day ? 'opacity-0' : ''}
                      ${isSelected
                        ? 'bg-accent text-white'
                        : isToday
                        ? 'border border-accent text-accent'
                        : 'hover:bg-surface-alt text-text-primary'
                      }
                      ${!day ? 'cursor-default' : 'cursor-pointer'}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Clear Button */}
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-xs py-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors border border-border"
              >
                Clear date
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
