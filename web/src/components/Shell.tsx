import type { ReactNode } from 'react';
import { QuickMenu } from './QuickMenu';
import { absoluteUrl, localePath, otherLocale, t, SITE, type Locale } from '@/lib/i18n';
import { fmtDate } from '@/lib/format';

interface ShellProps {
  locale: Locale;
  /** Locale-independent path of the current page, used for the language switch. */
  path: string;
  /** Which nav item to mark as current. */
  active?: 'trending' | 'languages' | 'rankings' | 'methodology' | 'about';
  lastCollected?: string | null;
  /**
   * What this page is about, in a sentence or two. Handed to whichever AI
   * assistant the reader picks, so the question arrives with context instead of
   * just a bare URL.
   */
  aiContext?: string;
  children: ReactNode;
}

export function Shell({ locale, path, active, lastCollected, aiContext, children }: ShellProps) {
  const d = t(locale);
  const other = otherLocale(locale);
  const link = (p: string) => localePath(locale, p);

  const pageUrl = absoluteUrl(locale, path);
  const ask =
    locale === 'vi'
      ? 'Giải thích và đánh giá giúp tôi nội dung sau.'
      : 'Explain and assess the following for me.';
  const aiPrompt = `${ask}\n\n${aiContext ?? `${SITE.name} — ${path}`}\n\n${
    locale === 'vi' ? 'Nguồn' : 'Source'
  }: ${pageUrl}`;

  return (
    <>
      <header className="site-header">
        <div className="wrap site-header__inner">
          <a className="brand" href={link('/')}>
            <span className="brand__mark" aria-hidden="true">
              ▲
            </span>
            {SITE.name}
          </a>

          <nav className="nav">
            <a href={link('/trending/weekly')} aria-current={active === 'trending' ? 'page' : undefined}>
              {d.nav.trending}
            </a>
            <a href={link('/languages')} aria-current={active === 'languages' ? 'page' : undefined}>
              {d.nav.languages}
            </a>
            <a href={link('/rankings')} aria-current={active === 'rankings' ? 'page' : undefined}>
              {d.nav.rankings}
            </a>
            <a href={link('/methodology')} aria-current={active === 'methodology' ? 'page' : undefined}>
              {d.nav.methodology}
            </a>
            <a href={link('/about')} aria-current={active === 'about' ? 'page' : undefined}>
              {d.nav.about}
            </a>
          </nav>

          {/* Points at the same page in the other language, so switching never
              dumps the reader back on the home page. */}
          <a className="lang-switch" href={localePath(other, path)} hrefLang={other}>
            {other === 'vi' ? 'VI' : 'EN'}
          </a>
        </div>
      </header>

      <main>
        <div className="wrap">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-row">
            <span>
              {SITE.name} · {d.footer.builtWith}
            </span>
            <span>
              <a href={link('/about')}>{d.nav.about}</a>
            </span>
            <span>
              <a href={link('/methodology')}>{d.nav.methodology}</a>
            </span>
            <span>{d.footer.notAffiliated}</span>
            {lastCollected ? (
              <span>
                {d.footer.lastUpdated}: {fmtDate(lastCollected, locale)}
              </span>
            ) : null}
            <span>
              <a href="https://docs.github.com/en/rest" rel="nofollow noopener">
                {d.footer.dataFrom}
              </a>
            </span>
          </div>
        </div>
      </footer>

      <QuickMenu
        otherLocaleHref={localePath(other, path)}
        otherLocaleCode={other}
        aiPrompt={aiPrompt}
        labels={{
          theme: {
            light: d.ui.themeLight,
            dark: d.ui.themeDark,
            system: d.ui.themeSystem,
          },
          language: d.ui.switchLanguage,
          toTop: d.ui.backToTop,
          askAi: d.ui.askAi,
          closeAi: d.ui.closeAi,
        }}
      />
    </>
  );
}
