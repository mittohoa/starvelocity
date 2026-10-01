'use client';

import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export interface QuickMenuLabels {
  theme: Record<Theme, string>;
  language: string;
  toTop: string;
  askAi: string;
  closeAi: string;
}

interface QuickMenuProps {
  /** Href of the current page in the other language. */
  otherLocaleHref: string;
  otherLocaleCode: string;
  /** The question plus page context handed to whichever assistant is picked. */
  aiPrompt: string;
  labels: QuickMenuLabels;
}

/**
 * Assistants that accept a prefilled query in the URL. Each opens in a new tab
 * with the prompt already typed — nothing is sent anywhere until the viewer
 * chooses one, so no page content leaves the browser on its own.
 */
const ASSISTANTS: { id: string; name: string; url: (q: string) => string }[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: q => `https://chatgpt.com/?q=${q}` },
  { id: 'claude', name: 'Claude', url: q => `https://claude.ai/new?q=${q}` },
  { id: 'perplexity', name: 'Perplexity', url: q => `https://www.perplexity.ai/search?q=${q}` },
  // udm=50 is Google's AI Mode.
  { id: 'google', name: 'Google AI', url: q => `https://www.google.com/search?udm=50&q=${q}` },
];

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // "System" is the absence of the attribute, so prefers-color-scheme decides.
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch {
    /* private mode — the choice just will not persist */
  }
}

const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const THEME_ICON: Record<Theme, React.ReactNode> = {
  light: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
    </svg>
  ),
  dark: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z" />
    </svg>
  ),
  system: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.8" y="4" width="18.4" height="12.5" rx="2" />
      <path d="M8.5 20.5h7" />
    </svg>
  ),
};

/**
 * Fixed dock in the bottom-right corner: ask an AI about this page, switch
 * language, switch theme, jump back to top.
 *
 * This is the only interactive JavaScript on the site, which is why it is the
 * only client component — every other byte is rendered once at build time.
 */
export function QuickMenu({ otherLocaleHref, otherLocaleCode, aiPrompt, labels }: QuickMenuProps) {
  const [theme, setTheme] = useState<Theme>('system');
  const [showTop, setShowTop] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // The server renders no stored preference, so the theme label would not match
  // what the inline script already applied. Settle it after mount.
  const [mounted, setMounted] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);

    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!aiOpen) return;
    const onAway = (e: MouseEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setAiOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAiOpen(false);
    };
    document.addEventListener('mousedown', onAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [aiOpen]);

  const cycleTheme = () => {
    const next = NEXT_THEME[theme];
    setTheme(next);
    applyTheme(next);
  };

  const encoded = encodeURIComponent(aiPrompt);

  return (
    <div className="quick-menu" ref={dockRef}>
      {aiOpen ? (
        <div className="ai-list" role="menu" aria-label={labels.askAi}>
          {ASSISTANTS.map(a => (
            <a
              key={a.id}
              className="ai-list__item"
              role="menuitem"
              href={a.url(encoded)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAiOpen(false)}
            >
              {a.name}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className={`quick-btn${aiOpen ? ' is-active' : ''}`}
        onClick={() => setAiOpen(v => !v)}
        aria-label={aiOpen ? labels.closeAi : labels.askAi}
        title={aiOpen ? labels.closeAi : labels.askAi}
        aria-expanded={aiOpen}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l1.9 4.9 4.9 1.9-4.9 1.9L12 16.1l-1.9-4.9-4.9-1.9 4.9-1.9L12 2.5z" />
          <path d="M18.5 15l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
        </svg>
      </button>

      <a
        className="quick-btn quick-btn--text"
        href={otherLocaleHref}
        hrefLang={otherLocaleCode}
        aria-label={labels.language}
        title={labels.language}
      >
        {otherLocaleCode.toUpperCase()}
      </a>

      <button
        type="button"
        className="quick-btn"
        onClick={cycleTheme}
        aria-label={labels.theme[theme]}
        title={labels.theme[theme]}
      >
        {mounted ? THEME_ICON[theme] : THEME_ICON.system}
      </button>

      <button
        type="button"
        className={`quick-btn quick-btn--accent${showTop ? '' : ' is-hidden'}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={labels.toTop}
        title={labels.toTop}
        tabIndex={showTop ? 0 : -1}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
        </svg>
      </button>
    </div>
  );
}
