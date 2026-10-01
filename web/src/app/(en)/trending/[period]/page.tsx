import { notFound } from 'next/navigation';
import { TrendingView } from '@/views/TrendingView';
import { trendingMeta } from '@/routes/meta';
import { trendingParams } from '@/routes/params';
import type { TrendingPeriod } from '@/lib/queries';

type Params = Promise<{ period: string }>;

const PERIODS: readonly string[] = ['daily', 'weekly', 'monthly'];

function parsePeriod(value: string): TrendingPeriod {
  if (!PERIODS.includes(value)) notFound();
  return value as TrendingPeriod;
}

export const generateStaticParams = trendingParams;

export async function generateMetadata({ params }: { params: Params }) {
  const { period } = await params;
  return trendingMeta('en', parsePeriod(period));
}

export default async function Page({ params }: { params: Params }) {
  const { period } = await params;
  return <TrendingView locale="en" period={parsePeriod(period)} />;
}
