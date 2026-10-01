import { OwnerView } from '@/views/RankingViews';
import { ownerMeta } from '@/routes/meta';
import { ownerParams } from '@/routes/params';

type Params = Promise<{ owner: string }>;

export const generateStaticParams = ownerParams;

export async function generateMetadata({ params }: { params: Params }) {
  const { owner } = await params;
  return ownerMeta('en', owner);
}

export default async function Page({ params }: { params: Params }) {
  const { owner } = await params;
  return <OwnerView locale="en" owner={owner} />;
}
