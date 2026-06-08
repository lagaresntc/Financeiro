import React, { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import { NavTab } from '../types';
import { Menu } from 'lucide-react';

interface LayoutProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  children: ReactNode;
}

export default function Layout({ activeTab, setActiveTab, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-[#12122a] border-b border-purple-900/30">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-purple-400 transition-colors"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-white font-semibold">Financeiro Pessoal</h1>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
