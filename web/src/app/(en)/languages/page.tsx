import { LanguagesView } from '@/views/LanguageViews';
import { languagesMeta } from '@/routes/meta';

export function generateMetadata() {
  return languagesMeta('en');
}

export default function Page() {
  return <LanguagesView locale="en" />;
}
