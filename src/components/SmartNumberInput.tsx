import React, { useState, useEffect, useRef } from 'react';

export interface SmartNumberInputProps {
  value: number | null | undefined;
  onChange: (val: number) => void;
  onCommit?: (val: number) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  step?: string | number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  debounceMs?: number;
}

export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  onCommit,
  onFocus,
  step = '0.1',
  min,
  max,
  placeholder,
  className,
  style,
  disabled,
  autoFocus,
  id,
  name,
  debounceMs = 120,
}) => {
  const formatVal = (v: number | null | undefined) => {
    if (v == null || isNaN(v)) return '';
    if (Math.abs(v) < 1e-6) return '0';
    const rounded = Math.round(v * 1e4) / 1e4;
    return String(rounded);
  };

  const [text, setText] = useState<string>(() => formatVal(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const isFocusedRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedValueRef = useRef<number | null | undefined>(value);

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Synchronize when value changes externally while not actively typing in this input
  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(formatVal(value));
      lastEmittedValueRef.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(',', '.');

    // Filter to allow valid number typing states (e.g., "", "-", "+", "0.", "-5.")
    if (/^[-+]?[0-9]*\.?[0-9]*$/.test(raw) || raw === '') {
      setText(raw);

      if (
        raw !== '' &&
        raw !== '-' &&
        raw !== '+' &&
        raw !== '.' &&
        raw !== '-.' &&
        raw !== '+.'
      ) {
        const num = parseFloat(raw);
        if (!isNaN(num)) {
          let clamped = num;
          if (min != null && clamped < min) clamped = min;
          if (max != null && clamped > max) clamped = max;
          clamped = Math.round(clamped * 1e4) / 1e4;

          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          if (debounceMs <= 0) {
            lastEmittedValueRef.current = clamped;
            onChange(clamped);
          } else {
            debounceTimerRef.current = setTimeout(() => {
              lastEmittedValueRef.current = clamped;
              onChange(clamped);
            }, debounceMs);
          }
        }
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    setIsFocused(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const raw = e.target.value.trim().replace(',', '.');

    if (
      raw === '' ||
      raw === '-' ||
      raw === '+' ||
      raw === '.' ||
      raw === '-.' ||
      raw === '+.' ||
      isNaN(Number(raw))
    ) {
      if (value == null) {
        setText('');
      } else {
        const fallback = 0;
        setText(String(fallback));
        lastEmittedValueRef.current = fallback;
        onChange(fallback);
        onCommit?.(fallback);
      }
    } else {
      let num = parseFloat(raw);
      if (min != null && num < min) num = min;
      if (max != null && num > max) num = max;
      num = Math.round(num * 1e4) / 1e4;
      setText(String(num));
      lastEmittedValueRef.current = num;
      onChange(num);
      onCommit?.(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      name={name}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={isFocused ? '' : placeholder}
      className={className}
      style={style}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="off"
      spellCheck={false}
    />
  );
};
