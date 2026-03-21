interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

const VARIANTS = {
  default: 'bg-slate-700 text-slate-300',
  success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  danger: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  info: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
};

const SIZES = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-sm' };

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${VARIANTS[variant]} ${SIZES[size]}`}>
      {children}
    </span>
  );
}
