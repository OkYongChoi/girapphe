import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export type StaticCardContent = Record<string, { summary: string; explanation: string }>;
export type StaticCardSummary = Record<string, { summary: string; hasContent: boolean }>;

let staticCardContentPromise: Promise<StaticCardContent> | null = null;
let staticCardSummaryPromise: Promise<StaticCardSummary> | null = null;

export async function getStaticCardContent(): Promise<StaticCardContent> {
  if (!staticCardContentPromise) {
    staticCardContentPromise = (async () => {
      const assets = getCloudflareContext().env.ASSETS;
      if (!assets) throw new Error('The static asset binding is unavailable.');
      const response = await assets.fetch(
        new Request('https://assets.local/localization/card-content.json'),
      );
      if (!response.ok) {
        throw new Error(`Unable to load the static card-content asset (${response.status}).`);
      }
      return response.json<StaticCardContent>();
    })().catch((error) => {
      staticCardContentPromise = null;
      throw error;
    });
  }
  return staticCardContentPromise;
}

export async function getStaticCardSummaries(): Promise<StaticCardSummary> {
  if (!staticCardSummaryPromise) {
    staticCardSummaryPromise = (async () => {
      const assets = getCloudflareContext().env.ASSETS;
      if (!assets) throw new Error('The static asset binding is unavailable.');
      const response = await assets.fetch(
        new Request('https://assets.local/localization/card-summary.json'),
      );
      if (!response.ok) {
        throw new Error(`Unable to load the static card-summary asset (${response.status}).`);
      }
      return response.json<StaticCardSummary>();
    })().catch((error) => {
      staticCardSummaryPromise = null;
      throw error;
    });
  }
  return staticCardSummaryPromise;
}
