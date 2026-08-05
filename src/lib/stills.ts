/**
 * The project "stills" — self-contained HTML/CSS recreations of app screens,
 * used as bare `<XyzStill />` tags in project MDX.
 *
 * This is the one list to edit when adding a still. The component itself is
 * picked up from src/components/stills automatically (see the glob in
 * src/pages/projects/[...slug].astro); what can't be inferred is the human
 * label Keystatic shows in its editor, so that lives here and is read by
 * keystatic.config.tsx.
 *
 * Keeping both sides on one list matters: Keystatic refuses to open an entry
 * containing a component it has no definition for, so a still that renders on
 * the site but is missing from the CMS registry makes that whole project
 * entry uneditable.
 */
export const STILL_LABELS: Record<string, string> = {
  AttendQuickMarkStill: 'Attend — quick-mark still',
  AttendStill: 'Attend still',
  HarmonyStill: 'Harmony still',
  HarmonyTodayStill: 'Harmony — today still',
  HisaabStill: 'Hisaab still',
  InferenceThroughputStill: 'Inference benchmark — throughput chart',
  InferenceTtftStill: 'Inference benchmark — TTFT chart',
  NilaCheckinStill: 'Nila — check-in still',
  NilaInsightsStill: 'Nila — insights still',
  NilaStill: 'Nila still',
  RituHomeStill: 'Ritu — home still',
  RituStill: 'Ritu still',
};

/** "NilaCheckinStill" → "Nila checkin still", for a still with no label yet. */
export function humanizeStillName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** The component name for a still's file path, e.g. ".../NilaStill.astro" → "NilaStill". */
export function stillNameFromPath(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1).replace(/\.astro$/, '');
}
