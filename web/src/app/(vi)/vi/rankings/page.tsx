import { RankingsView } from '@/views/RankingViews';
import { rankingsMeta } from '@/routes/meta';

export function generateMetadata() {
  return rankingsMeta('vi');
}

export default function Page() {
  return <RankingsView locale="vi" />;
}
