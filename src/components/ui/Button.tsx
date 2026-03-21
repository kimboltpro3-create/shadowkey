import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-900 font-semibold shadow-md shadow-cyan-500/25 hover:shadow-cyan-500/40',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 hover:border-slate-600',
  ghost:
    'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200',
  danger:
    'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50',
  outline:
    'bg-transparent border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-slate-800/40',
  success:
    'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-2.5 text-sm rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 ${VARIANTS[variant]} ${SIZES[size]} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
