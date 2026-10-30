import React from 'react';
import { Volume2 } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-900 leading-tight">Dettato Audio MP3</h1>
            <p className="text-xs text-stone-500">Crea file audio di dettati per la scuola</p>
          </div>
        </div>
        <span className="text-xs font-medium text-stone-500">Voce Google Italiano</span>
      </div>
    </header>
  );
};
