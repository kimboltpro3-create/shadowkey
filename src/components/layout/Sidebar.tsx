import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShieldCheck, ScrollText, Zap, Settings, Lock } from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
      { to: '/vault', icon: Lock, labelKey: 'nav.vault' },
      { to: '/policies', icon: ShieldCheck, labelKey: 'nav.policies' },
    ],
  },
  {
    label: 'Demo & Audit',
    items: [
      { to: '/agent-demo', icon: Zap, label: 'Agent Demo' },
      { to: '/audit', icon: ScrollText, labelKey: 'nav.audit' },
    ],
  },
];

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/vault', icon: Lock, labelKey: 'nav.vault' },
  { to: '/policies', icon: ShieldCheck, labelKey: 'nav.policies' },
  { to: '/audit', icon: ScrollText, labelKey: 'nav.audit' },
  { to: '/agent-demo', icon: Zap, label: 'Demo' },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="fixed top-14 left-0 bottom-0 w-52 bg-slate-950/80 backdrop-blur-sm border-r border-slate-800/60 flex flex-col py-3 z-30 hidden md:flex">
      <nav className="flex-1 px-2 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, labelKey, label }: { to: string; icon: React.ElementType; labelKey?: string; label?: string }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Icon size={14} />
                  {label ?? (labelKey ? t(labelKey) : '')}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 border-t border-slate-800/60 pt-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-slate-800/60 text-slate-200'
                : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800/40'
            }`
          }
        >
          <Settings size={14} />
          {t('nav.settings')}
        </NavLink>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { t } = useTranslation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/60 flex z-40">
      {MOBILE_NAV_ITEMS.map(({ to, icon: Icon, labelKey, label }: { to: string; icon: React.ElementType; labelKey?: string; label?: string }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${
              isActive ? 'text-cyan-400' : 'text-slate-600 hover:text-slate-300'
            }`
          }
        >
          <Icon size={17} />
          {label ?? (labelKey ? t(labelKey) : '')}
        </NavLink>
      ))}
    </nav>
  );
}
