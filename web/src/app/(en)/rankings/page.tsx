import { RankingsView } from '@/views/RankingViews';
import { rankingsMeta } from '@/routes/meta';

export function generateMetadata() {
  return rankingsMeta('en');
}

export default function Page() {
  return <RankingsView locale="en" />;
}
