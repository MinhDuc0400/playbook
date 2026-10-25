import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { fieldClasses } from './TextInput';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

/** Native select with a visible label. Pass `<option>` children. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, className = '', children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <select ref={ref} id={selectId} className={`${fieldClasses} ${className}`.trim()} {...rest}>
        {children}
      </select>
    </div>
  );
});
