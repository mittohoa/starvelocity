import type { ReactNode } from 'react';

/** Structured data. Content is pre-escaped by the helpers in lib/seo. */
export function JsonLd({ json }: { json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function Notice({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="notice" role="note">
      {title ? <strong>{title}</strong> : null}
      <p>{children}</p>
    </div>
  );
}

export function SectionHead({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section__head">
      <h2>{title}</h2>
      {href && linkLabel ? <a href={href}>{linkLabel} →</a> : null}
    </div>
  );
}

export function Tabs({ items }: { items: { label: string; href: string; current: boolean }[] }) {
  return (
    <div className="tabs">
      {items.map(item => (
        <a key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
          {item.label}
        </a>
      ))}
    </div>
  );
}
