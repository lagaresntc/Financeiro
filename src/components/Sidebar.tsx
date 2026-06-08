import { Home, CreditCard, List, TrendingUp, DollarSign, LucideIcon } from 'lucide-react';
import { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const navItems: { tab: NavTab; label: string; Icon: LucideIcon }[] = [
  { tab: 'dashboard', label: 'Dashboard', Icon: Home },
  { tab: 'cards', label: 'Cartões', Icon: CreditCard },
  { tab: 'installments', label: 'Parcelas', Icon: List },
  { tab: 'investments', label: 'Investimentos', Icon: TrendingUp },
  { tab: 'income', label: 'Receitas Fixas', Icon: DollarSign },
];

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, setMobileOpen }: SidebarProps) {
  const handleNav = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-[#12122a] border-r border-purple-900/30 z-30
          flex flex-col transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <DollarSign size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Financeiro</h1>
              <p className="text-purple-400 text-xs mt-0.5">Controle Pessoal</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ tab, label, Icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleNav(tab)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                    : 'text-slate-400 hover:bg-purple-900/20 hover:text-purple-300'
                  }
                `}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-purple-400'} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-purple-900/30">
          <p className="text-slate-600 text-xs text-center">v1.0.0 · Dados locais</p>
        </div>
      </aside>
    </>
  );
}
