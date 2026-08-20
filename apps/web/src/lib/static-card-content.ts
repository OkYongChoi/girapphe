import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export type StaticCardContent = Record<string, { summary: string; explanation: string }>;

let staticCardContentPromise: Promise<StaticCardContent> | null = null;

export async function getStaticCardContent(): Promise<StaticCardContent> {
  if (!staticCardContentPromise) {
    staticCardContentPromise = (async () => {
      const assets = getCloudflareContext().env.ASSETS;
      if (!assets) throw new Error('The static asset binding is unavailable.');
      const response = await assets.fetch('https://assets.local/localization/card-content.json');
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
