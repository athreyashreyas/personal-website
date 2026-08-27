import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';

/** The card a page's og:image is drawn from. */
export type OgCard = {
  /** Route path under /og, without a leading slash or the .png suffix. */
  path: string;
  /** Small tracked label above the title — the section, usually. */
  eyebrow: string;
  title: string;
  /** Optional bottom-right detail: a date, a status, a count. */
  meta?: string;
};

// Facebook/Twitter/Slack/iMessage all crop to roughly 1.91:1.
const WIDTH = 1200;
const HEIGHT = 630;

// The light-mode tokens from global.css. Hard-coded rather than parsed out of
// the CSS: an OG card is always the paper theme regardless of what the reader's
// system prefers, since the image is baked at build time and can't adapt.
const PAPER = '#FAF8F3';
const INK = '#2B2420';
const MUTED = '#6B6558';
const ACCENT = '#58A588';

/**
 * The self-hosted families, as .woff.
 *
 * @fontsource ships .woff alongside .woff2 and satori reads the former but not
 * the latter, so these are the variants to point at.
 *
 * Resolved through require.resolve rather than a path relative to this file:
 * at build time this module has been bundled into dist/, so `new URL('../..',
 * import.meta.url)` points at dist/node_modules — which does not exist. Node's
 * resolver walks up to the real one from either location.
 */
const FONT_FILES = {
  serif: '@fontsource/newsreader/files/newsreader-latin-600-normal.woff',
  sans: '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff',
} as const;

/**
 * Loaded once per build rather than per card — there is one of these per page
 * on the site, and re-reading two font files for each is pure waste.
 */
let fontsPromise: Promise<Parameters<typeof satori>[1]['fonts']> | undefined;

const resolve = createRequire(import.meta.url).resolve;

function loadFonts() {
  fontsPromise ??= Promise.all(
    Object.entries(FONT_FILES).map(async ([kind, spec]) => ({
      name: kind === 'serif' ? 'Newsreader' : 'Plus Jakarta Sans',
      data: await readFile(resolve(spec)),
      weight: (kind === 'serif' ? 600 : 500) as 500 | 600,
      style: 'normal' as const,
    })),
  );
  return fontsPromise;
}

/**
 * Titles are authored for a page, not for a 1200px card, so long ones are cut
 * rather than allowed to overflow or shrink to unreadable. Breaks on a word
 * boundary when there is one near the limit.
 */
function fit(title: string, limit = 90): string {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Bigger type for a short title, smaller for a long one. */
function titleSize(length: number): number {
  if (length <= 28) return 76;
  if (length <= 55) return 62;
  return 50;
}

/**
 * Satori takes React elements; this file is plain .ts, so the elements are
 * built as the objects React would have produced. Avoids making the module
 * .tsx and pulling the JSX runtime in purely to describe a static card.
 *
 * Every container sets `display: flex` explicitly: satori is Yoga-based and
 * treats an unset display on a multi-child div as an error rather than
 * defaulting to block the way a browser would.
 */
function el(type: string, style: Record<string, unknown>, children?: unknown) {
  return { type, props: { style, children } };
}

function card({ eyebrow, title, meta }: OgCard) {
  return el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: PAPER,
      padding: '72px 80px',
      fontFamily: 'Plus Jakarta Sans',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          fontSize: 24,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
        },
        eyebrow,
      ),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: 'Newsreader',
          fontSize: titleSize(title.length),
          lineHeight: 1.15,
          color: INK,
          // Satori has no auto-shrink; the cut in fit() is what keeps a long
          // title inside the box, and this caps how far it can run regardless.
          maxHeight: 320,
          overflow: 'hidden',
        },
        fit(title),
      ),
      el(
        'div',
        { display: 'flex', flexDirection: 'column' },
        [
          el('div', { display: 'flex', width: 88, height: 3, backgroundColor: ACCENT }),
          el(
            'div',
            {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: 22,
              fontSize: 26,
            },
            [
              el('div', { display: 'flex', color: INK }, 'Shreyas Athreya'),
              meta ? el('div', { display: 'flex', color: MUTED, fontSize: 22 }, meta) : null,
            ],
          ),
        ],
      ),
    ],
  );
}

/** Render one card to PNG bytes. */
export async function renderCard(spec: OgCard): Promise<Buffer> {
  const svg = await satori(card(spec) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts(),
  });
  // Satori converts text to paths, so rasterizing needs no font access here.
  return sharp(Buffer.from(svg)).png().toBuffer();
}
