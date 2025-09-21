import React from 'react'

export function Button({ variant = 'default', size = 'md', className = '', children, ...props }) {
  const base = 'btn';
  const variants = {
    default: 'btn-default',
    destructive: 'btn-destructive',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    subtle: 'btn-subtle',
    text: 'btn-text',
    gradient: 'gradient-cta text-white'
  };
  const sizes = {
    md: '',
    lg: 'btn-lg'
  };
  const cls = [base, variants[variant] || variants.default, sizes[size] || '', className].join(' ').trim();
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
