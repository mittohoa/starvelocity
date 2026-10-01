import { localePath, t } from '@/lib/i18n';

export const metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const d = t('en');
  return (
    <main>
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 120 }}>
        <p className="eyebrow">404</p>
        <h1>Nothing here</h1>
        <p className="lead" style={{ marginTop: 12 }}>
          That page does not exist, or the repository it described is no longer tracked.
        </p>
        <div className="cta-row">
          <a className="button button--primary" href={localePath('en', '/')}>
            {d.common.backHome}
          </a>
          <a className="button" href={localePath('en', '/trending/weekly')}>
            {d.nav.trending}
          </a>
        </div>
      </div>
    </main>
  );
}
