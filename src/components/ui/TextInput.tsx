import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
}

export const fieldClasses =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={hint ? hintId : undefined}
        className={`${fieldClasses} ${className}`.trim()}
        {...rest}
      />
      {hint ? (
        <span id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
