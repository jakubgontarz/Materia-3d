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
}) => {
  const formatVal = (v: number | null | undefined) => {
    if (v == null || isNaN(v)) return '';
    return String(v);
  };

  const [text, setText] = useState<string>(() => formatVal(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const isFocusedRef = useRef<boolean>(false);

  // Synchronize when value changes externally while not actively typing in this input
  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(formatVal(value));
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
          onChange(clamped);
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
        onChange(fallback);
        onCommit?.(fallback);
      }
    } else {
      let num = parseFloat(raw);
      if (min != null && num < min) num = min;
      if (max != null && num > max) num = max;
      setText(String(num));
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
