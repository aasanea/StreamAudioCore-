code = '''import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TitleBar } from '../../components/TitleBar';
import { GlassPanel } from '../ui/GlassPanel';
import { Typography } from '../ui/Typography';
import { IconButton } from '../ui/IconButton';
import { Radio, Menu, ChevronLeft } from 'lucide-react';
import { TABS } from '../../constants';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  globalOutputDevice: string;
}

export function AppLayout({
  children,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  globalOutputDevice
}: AppLayoutProps) {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-cairo bg-transparent text-white select-none">
      <TitleBar activeTab={activeTab} />
      
      {/* Top Header */}
      <GlassPanel intensity="high" className="h-[90px] flex-shrink-0 flex items-center justify-between px-6 z-30 rounded-none border-t-0 border-l-0 border-r-0 border-b-white/5">
        
        {/* Logo Area */}
        <div className="flex items-center gap-4 w-[240px]">
          <div className="text-ocean-400 relative flex items-center justify-center w-10 h-10">
            <Radio size={36} strokeWidth={2.5} className="relative z-10 drop-shadow-[0_0_12px_rgba(56,126,162,0.6)]" />
            <div className="absolute inset-0 bg-ocean-500/20 blur-md rounded-full" />
          </div>
          <div className="flex flex-col -gap-1 text-right">
            <span className="text-xl font-black tracking-widest text-white leading-tight">StreamAudio</span>
            <span className="text-2xl font-black text-ocean-500 leading-none mt-0.5 tracking-wider">CORE</span>
          </div>
        </div>

        {/* Center Space */}
        <div className="flex-1 flex justify-center">
          {/* Can place a global search bar or master transport here in the future */}
        </div>

        {/* Right Area: System Status */}
        <div className="flex items-center gap-4 w-[240px] justify-end">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-bold text-ocean-400 uppercase tracking-widest">SYSTEM AUDIO</span>
            <span className="text-[13px] font-medium text-zinc-300 truncate max-w-[180px]">
              {globalOutputDevice === 'default' ? '????????? (Default)' : globalOutputDevice}
            </span>
          </div>
        </div>
      </GlassPanel>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative z-20">
        
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-shrink-0 h-full flex flex-col z-20 border-l border-white/5 bg-[#0a0d0f]/60 backdrop-blur-md"
        >
          {/* Collapse Toggle */}
          <div className={lex items-center px-5 pt-4 }>
            <IconButton 
              icon={isSidebarCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "????? ??????" : "?? ??????"}
            />
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 p-5 mt-2">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={
                    relative flex items-center gap-4 rounded-xl transition-all duration-200 outline-none
                    
                    
                  }
                >
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active-indicator"
                      className={bsolute top-2 bottom-2 w-[4px] bg-ocean-400 rounded-full }
                      style={{ boxShadow: "0 0 12px rgba(56, 126, 162, 0.8)" }}
                    />
                  )}
                  <Icon size={22} className={isActive ? 'text-ocean-400' : ''} strokeWidth={isActive ? 2.5 : 2} />
                  {!isSidebarCollapsed && (
                    <Typography variant="body" color={isActive ? 'primary' : 'muted'} className="flex-1 font-bold whitespace-nowrap overflow-hidden">
                      {tab.label}
                    </Typography>
                  )}
                </button>
              );
            })}
          </nav>
        </motion.aside>

        {/* Content Area */}
        <main className="flex-1 relative overflow-y-auto z-10 custom-scrollbar">
          {children}
        </main>

      </div>
    </div>
  );
}
'''
with open('src/components/layout/AppLayout.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
