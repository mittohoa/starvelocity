import { AboutView } from '@/views/AboutView';
import { aboutMeta } from '@/routes/meta';

export function generateMetadata() {
  return aboutMeta('en');
}

export default function Page() {
  return <AboutView locale="en" />;
}
