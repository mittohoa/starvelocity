import { LanguagesView } from '@/views/LanguageViews';
import { languagesMeta } from '@/routes/meta';

export function generateMetadata() {
  return languagesMeta('vi');
}

export default function Page() {
  return <LanguagesView locale="vi" />;
}
