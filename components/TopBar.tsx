import React from 'react';
import { Scale } from 'lucide-react';

const TopBar: React.FC = () => {
  return (
    <div className="h-16 w-full bg-gradient-to-r from-navy-900 to-charcoal-800 flex items-center justify-between px-6 border-b border-gold-100 shadow-md z-20 relative">
      {/* Left: Logo Area */}
      <div className="w-[200px] h-12 bg-white/5 rounded flex items-center px-3 space-x-3">
        <div className="w-8 h-8 rounded bg-gold-500/20 flex items-center justify-center">
             <Scale className="text-gold-500 w-5 h-5" />
        </div>
        <div className="flex flex-col">
            <span className="text-white text-xs font-semibold tracking-wide">SHIELDS & PARTNERS</span>
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">Legal Services</span>
        </div>
      </div>

      {/* Center: App Title */}
      <h1 className="text-white text-2xl font-semibold tracking-tight hidden md:block absolute left-1/2 -translate-x-1/2">
        Legal Document Translator
      </h1>
    </div>
  );
};

export default TopBar;