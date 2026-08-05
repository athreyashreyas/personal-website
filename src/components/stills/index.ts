import { STILL_LABELS, stillNameFromPath } from '../../lib/stills';

/**
 * Every still in this directory, keyed by the tag name project MDX uses for it
 * (`<NilaStill />` → NilaStill).
 *
 * Stills are handed to MDX as components rather than imported inside each
 * write-up because Keystatic's editor can't parse hand-written `import`
 * statements in content — only registered component tags. Collecting them from
 * the directory rather than listing them by hand means adding a file is all it
 * takes to use its tag.
 *
 * Module scope on purpose: an Astro component's frontmatter runs per request,
 * so building this there would redo the work (and re-log the warning below) on
 * every page render.
 */
const modules = import.meta.glob<{ default: unknown }>('./*Still.astro', {
  eager: true,
});

export const stillComponents: Record<string, any> = Object.fromEntries(
  Object.entries(modules).map(([filePath, module]) => [
    stillNameFromPath(filePath),
    module.default,
  ]),
);

// The other half of the registration lives in keystatic.config.tsx, which reads
// STILL_LABELS. A still missing from there renders fine on the site but makes
// every project entry using it impossible to open in the CMS — so say so, once,
// while authoring.
if (import.meta.env.DEV) {
  const unlabelled = Object.keys(stillComponents).filter((name) => !STILL_LABELS[name]);
  if (unlabelled.length > 0) {
    console.warn(
      `[stills] Not registered for the CMS: ${unlabelled.join(', ')}. ` +
        'Add them to src/lib/stills.ts, or Keystatic will refuse to open any ' +
        'project entry that uses them.',
    );
  }
}
