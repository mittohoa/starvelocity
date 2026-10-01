import { AboutView } from '@/views/AboutView';
import { aboutMeta } from '@/routes/meta';

export function generateMetadata() {
  return aboutMeta('vi');
}

export default function Page() {
  return <AboutView locale="vi" />;
}
