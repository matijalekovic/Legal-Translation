import React from 'react';
import { Scale, ChevronDown, LogOut } from 'lucide-react';
import Logo from '../images/Logo.svg';

const LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'sr', name: 'Serbian' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
];

interface LanguageSelectProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  position: 'left' | 'right';
  excludeAuto?: boolean;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ label, value, onChange, position, excludeAuto = false }) => {
  const availableLanguages = excludeAuto
    ? LANGUAGES.filter(lang => lang.code !== 'auto')
    : LANGUAGES;

  return (
    <div className={`flex flex-col items-${position === 'left' ? 'end' : 'start'} gap-0.5 lg:gap-1`}>
      <span className="text-white/50 text-[9px] lg:text-[10px] uppercase tracking-wider font-medium">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 rounded-md pl-2.5 lg:pl-3 pr-7 lg:pr-8 py-1 lg:py-1.5 text-white/90 text-xs lg:text-sm font-medium cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 min-w-[115px] lg:min-w-[130px]"
        >
          {availableLanguages.map(lang => (
            <option key={lang.code} value={lang.code} className="bg-navy-900 text-white">
              {lang.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 lg:right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/40 pointer-events-none" />
      </div>
    </div>
  );
};

interface TopBarProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceLanguageChange: (code: string) => void;
  onTargetLanguageChange: (code: string) => void;
  user?: { email: string; name: string; picture: string };
  onLogout?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange,
  user,
  onLogout,
}) => {
  return (
    <div className="h-14 lg:h-16 w-full bg-gradient-to-r from-navy-900 to-charcoal-800 flex items-center justify-between px-4 lg:px-6 border-b border-gold-100 shadow-md z-20 relative">
            {/* Left: Logo Area */}
      <div className="w-[280px] lg:w-[350px] h-full flex items-center">
        <img src={Logo} alt="Shields & Partners Logo" className="w-40 lg:w-48" style={{ maxHeight: 'none' }} />
      </div>

      {/* Center: Language Selection + Title */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-12 lg:gap-20">
        {/* Source Language (FROM) - Left of title */}
        <LanguageSelect
          label="Translate From"
          value={sourceLanguage}
          onChange={onSourceLanguageChange}
          position="left"
        />

        {/* App Title */}
        <h1 className="text-white text-base lg:text-xl font-semibold tracking-tight hidden md:block">
          Legal Document Translator
        </h1>

        {/* Target Language (TO) - Right of title */}
        <LanguageSelect
          label="Translate To"
          value={targetLanguage}
          onChange={onTargetLanguageChange}
          position="right"
          excludeAuto={true}
        />
      </div>

      {/* Right: User Info & Logout */}
      <div className="w-[280px] lg:w-[350px] flex items-center justify-end gap-2 lg:gap-3 px-2 lg:px-4">
        {user && (
          <>
            <div className="flex items-center gap-2">
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 lg:w-8 lg:h-8 rounded-full border-2 border-white/20"
              />
              <div className="hidden lg:block">
                <p className="text-white text-xs lg:text-sm font-medium">{user.name}</p>
                <p className="text-white/50 text-[10px] lg:text-xs">{user.email}</p>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 lg:p-2 rounded-md hover:bg-white/10 transition-colors group"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white/60 group-hover:text-white/90" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TopBar;