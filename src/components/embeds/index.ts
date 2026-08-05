import { EMBED_LABELS, embedNameFromPath } from '../../lib/embeds';

/**
 * Every embed in this directory, keyed by the tag name project MDX uses for it
 * (`<LatencyWidget />` → LatencyWidget).
 *
 * Mirrors src/components/stills/index.ts — see the reasoning there for why
 * these are handed to MDX as components rather than imported per write-up, and
 * why the glob beats a hand-maintained list.
 */
const modules = import.meta.glob<{ default: unknown }>('./*Widget.astro', {
  eager: true,
});

export const embedComponents: Record<string, any> = Object.fromEntries(
  Object.entries(modules).map(([filePath, module]) => [
    embedNameFromPath(filePath),
    module.default,
  ]),
);

// The other half of the registration lives in keystatic.config.tsx, which reads
// EMBED_LABELS. An embed missing from there renders fine on the site but makes
// every project entry using it impossible to open in the CMS.
if (import.meta.env.DEV) {
  const unlabelled = Object.keys(embedComponents).filter((name) => !EMBED_LABELS[name]);
  if (unlabelled.length > 0) {
    console.warn(
      `[embeds] Not registered for the CMS: ${unlabelled.join(', ')}. ` +
        'Add them to src/lib/embeds.ts, or Keystatic will refuse to open any ' +
        'project entry that uses them.',
    );
  }
}
