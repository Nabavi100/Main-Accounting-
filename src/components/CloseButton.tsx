import React from 'react';
import { X } from 'lucide-react';

type CloseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; variant?: 'solid' | 'outline' };

/** A real non-submitting close control, with an always-visible label (including on phones). */
export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(
  { className = '', label = 'بستن', variant = 'solid', children: _children, ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" data-ui-action="close" data-close-variant={variant} className={`app-action app-close-button ${className}`.trim()}
    aria-label={props['aria-label'] || (label === 'بستن' ? 'بستن پنجره' : label)} title={props.title || 'بستن؛ بدون ثبت اطلاعات'}>
    <X aria-hidden="true" /><span>{label}</span>
  </button>;
});
