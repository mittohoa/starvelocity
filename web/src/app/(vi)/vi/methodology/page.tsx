import { MethodologyView } from '@/views/MethodologyView';
import { methodologyMeta } from '@/routes/meta';

export function generateMetadata() {
  return methodologyMeta('vi');
}

export default function Page() {
  return <MethodologyView locale="vi" />;
}
