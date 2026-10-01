import { RepoView } from '@/views/RepoView';
import { repoMeta } from '@/routes/meta';
import { repoParams } from '@/routes/params';

type Params = Promise<{ owner: string; name: string }>;

export const generateStaticParams = repoParams;

export async function generateMetadata({ params }: { params: Params }) {
  const { owner, name } = await params;
  return repoMeta('vi', owner, name);
}

export default async function Page({ params }: { params: Params }) {
  const { owner, name } = await params;
  return <RepoView locale="vi" owner={owner} name={name} />;
}
