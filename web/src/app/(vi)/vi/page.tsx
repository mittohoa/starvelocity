import { HomeView } from '@/views/HomeView';
import { homeMeta } from '@/routes/meta';

export function generateMetadata() {
  return homeMeta('vi');
}

export default function Page() {
  return <HomeView locale="vi" />;
}
