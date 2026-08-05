/**
 * Project "embeds" — interactive widgets used as bare <XyzWidget /> tags in
 * project MDX, alongside the static stills.
 *
 * Same two-sided registration as the stills (see src/lib/stills.ts): the
 * component is picked up from src/components/embeds automatically, while the
 * human label Keystatic shows lives here and is read by keystatic.config.tsx.
 * An embed missing from the CMS side renders fine on the site but makes every
 * project entry using it impossible to open in Keystatic.
 *
 * Unlike stills, these take props — but Keystatic only ever needs to know the
 * tag exists, so the definitions there stay schema-less and the props are set
 * in the MDX by hand.
 */
export const EMBED_LABELS: Record<string, string> = {
  LatencyWidget: 'Interactive — the number you feel (TTFT vs throughput)',
  LifeInWeeksWidget: 'Interactive — life in weeks grid',
  ServerSeesWidget: 'Interactive — what the server sees (encryption demo)',
};

/** The component name for an embed's path, e.g. ".../LatencyWidget.astro" → "LatencyWidget". */
export function embedNameFromPath(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.astro$/, '');
}
