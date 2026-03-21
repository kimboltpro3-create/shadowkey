import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 hover:border-sky-300 dark:hover:border-slate-700 transition-colors">
        <Globe size={16} className="text-slate-600 dark:text-slate-400" />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {languages.find((l) => l.code === i18n.language)?.flag || '🌐'}
        </span>
      </button>

      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors first:rounded-t-lg last:rounded-b-lg ${
              i18n.language === lang.code
                ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-cyan-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="text-sm font-medium">{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
