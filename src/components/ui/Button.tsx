import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400',
};

export const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-2 py-1 text-sm lg:min-h-0',
  md: 'min-h-10 px-3 py-1.5 text-base lg:min-h-0',
};

export const baseClasses =
  'inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', type = 'button', className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...rest}
    />
  );
});
