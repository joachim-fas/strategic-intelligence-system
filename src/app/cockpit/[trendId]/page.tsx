import { redirect } from "next/navigation";
export default async function CockpitTrendPage({ params }: { params: Promise<{ trendId: string }> }) {
  const { trendId } = await params;
  redirect(`/verstehen/${trendId}`);
}
