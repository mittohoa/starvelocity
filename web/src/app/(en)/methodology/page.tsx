import { MethodologyView } from '@/views/MethodologyView';
import { methodologyMeta } from '@/routes/meta';

export function generateMetadata() {
  return methodologyMeta('en');
}

export default function Page() {
  return <MethodologyView locale="en" />;
}
