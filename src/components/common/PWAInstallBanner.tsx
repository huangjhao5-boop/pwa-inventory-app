import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <aside aria-label="アプリインストール案内" className="bg-gradient-to-r from-blue-900/90 to-indigo-900/90 border-b border-blue-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-white shadow-lg">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-500/20 rounded-lg">
          <Download className="w-4 h-4 text-blue-300 animate-bounce" />
        </div>
        <span>
          <strong>ホーム画面に追加</strong> すると、現場で電波がなくても高速起動して使えます！
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold rounded-lg transition"
        >
          インストール
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 text-slate-300 hover:text-white rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
