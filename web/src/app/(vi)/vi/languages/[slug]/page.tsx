import { LanguageDetailView } from '@/views/LanguageViews';
import { languageDetailMeta } from '@/routes/meta';
import { languageParams } from '@/routes/params';

type Params = Promise<{ slug: string }>;

export const generateStaticParams = languageParams;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  return languageDetailMeta('vi', slug);
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  return <LanguageDetailView locale="vi" slug={slug} />;
}
