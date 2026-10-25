import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { baseClasses, variantClasses, type ButtonVariant } from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name (NFR-UX-03); also used as the tooltip. */
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', type = 'button', className = '', ...rest },
  ref,
) {
  const dims = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base';
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`${baseClasses} ${variantClasses[variant]} ${dims} ${className}`.trim()}
      {...rest}
    />
  );
});
