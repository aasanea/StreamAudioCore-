import React from "react";
import { motion } from "framer-motion";
import { TitleBar } from "../../components/TitleBar";
import { IconButton } from "../ui/IconButton";
import { Logo } from "../ui/Logo";
import { AnimatedWaveBg } from "../ui/AnimatedWaveBg";
import { Menu, ChevronLeft, Bell } from "lucide-react";
import { useLanguage } from "../../i18n";
import { LanguageToggle } from "../ui/LanguageToggle";

interface TabItem {
  id: string;
  icon: any;
  label: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  tabs: readonly TabItem[];
}

export function AppLayout({
  children,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  tabs
}: AppLayoutProps) {
  const { t, dir } = useLanguage();

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-cairo text-white select-none bg-brand-900" dir={dir}>
      <TitleBar activeTab={activeTab} />
      
      {/* Top Header */}
      <div className="h-[60px] flex-shrink-0 flex items-center justify-between px-6 z-30 bg-brand-900 border-b border-brand-500/30 shadow-sm relative">
        
        {/* Logo Area */}
        <Logo variant="horizontal" size={170} className="ml-2" />

        {/* Center Space */}
        <div className="flex-1 flex justify-center">
        </div>

        {/* Right Area: System Status & Notifications */}
        <div className="flex items-center gap-6 justify-end">
          
          <LanguageToggle />

          {/* Notification Bell */}
          <div className="relative flex items-center justify-center">
            <IconButton
              icon={<Bell size={18} />}
              variant="ghost"
              className="text-brand-200 hover:text-white hover:bg-white/10"
              title={t('layout_notifications')}
            />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-brand-900 rounded-full animate-pulse"></span>
          </div>


        </div>
      </div>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative z-20">
        
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex-shrink-0 h-full flex flex-col z-20 bg-[#090916] border-l border-[#312E81]/30 shadow-[-10px_0_30px_rgba(0,0,0,0.4)]"
        >
          {/* Collapse Toggle */}
          <div className={`flex items-center px-5 pt-4 ${isSidebarCollapsed ? "justify-center" : "justify-end"}`}>
            <IconButton 
              icon={isSidebarCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? t('layout_expand') : t('layout_collapse')}
            />
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 p-5 mt-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    relative flex items-center gap-4 rounded-xl outline-none transition-colors duration-300 z-10
                    ${isSidebarCollapsed ? "justify-center w-12 h-12 mx-auto" : "px-5 py-3.5 w-full"}
                    ${isActive 
                      ? "text-[#0F0F23] font-black" 
                      : "text-brand-300 hover:text-brand-100 hover:bg-brand-700/5"}
                  `}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-0 bg-brand-700 rounded-xl -z-10 shadow-[0_0_22px_rgba(128,170,160,0.65)] filter blur-[0.5px]"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon size={22} className={isActive ? "text-[#0F0F23]" : "text-brand-300"} strokeWidth={isActive ? 2.5 : 2} />
                  {!isSidebarCollapsed && (
                    <span className="flex-1 font-bold whitespace-nowrap overflow-hidden text-right">
                      {tab.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </motion.aside>

        {/* Content Area */}
        <main className="flex-1 relative overflow-y-auto z-10 custom-scrollbar">
          <AnimatedWaveBg />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
