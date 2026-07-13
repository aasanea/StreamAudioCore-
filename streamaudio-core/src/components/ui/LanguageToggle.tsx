import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../i18n';

export const LanguageToggle: React.FC = () => {
  const { lang, setLang } = useLanguage();

  const toggleLang = () => {
    setLang(lang === 'ar' ? 'en' : 'ar');
  };

  return (
    <button
      onClick={toggleLang}
      className="relative flex items-center p-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-md cursor-pointer overflow-hidden transition-colors hover:border-brand-500/50"
      style={{ width: '64px', height: '28px', flexShrink: 0 }}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
    >
      {/* Active Indicator Background */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-full bg-brand-600 shadow-[0_0_10px_rgba(128,170,160,0.5)]"
        initial={false}
        animate={{
          left: lang === 'ar' ? 'auto' : '4px',
          right: lang === 'ar' ? '4px' : 'auto',
          width: '28px'
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      
      {/* Labels */}
      <div className="relative z-10 flex w-full justify-between items-center px-[8px]">
        <span 
          className={`text-[10px] font-bold ${lang === 'en' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300`}
          style={{ width: '20px', textAlign: 'center', marginTop: lang === 'en' ? '0' : '1px' }}
        >
          EN
        </span>
        <span 
          className={`text-[10px] font-bold ${lang === 'ar' ? 'text-white' : 'text-zinc-500'} transition-colors duration-300`}
          style={{ width: '20px', textAlign: 'center', marginTop: lang === 'ar' ? '-1px' : '0' }}
        >
          AR
        </span>
      </div>
    </button>
  );
};
