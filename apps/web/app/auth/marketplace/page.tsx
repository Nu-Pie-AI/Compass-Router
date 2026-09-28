import { MarketplaceAuthCallback } from "../../../components/MarketplaceAuthCallback";

export default async function MarketplaceAuthPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <MarketplaceAuthCallback token={params.token ?? ""} />;
}
