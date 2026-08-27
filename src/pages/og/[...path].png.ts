import type { APIRoute, GetStaticPaths } from 'astro';
import { renderCard, type OgCard } from '../../lib/og';
import { ogCards } from '../../lib/og-routes';

/**
 * The social preview images, rendered to PNG at build time.
 *
 * One route rather than a file per section: the card list in lib/og-routes.ts
 * already knows every page that needs one, and a rest param turns each entry's
 * `path` straight into the URL BaseLayout points at.
 *
 * PNG rather than SVG because the platforms that consume og:image — Slack,
 * iMessage, WhatsApp, X — either ignore SVG or render it inconsistently.
 */
export const getStaticPaths = (async () => {
  const cards = await ogCards();
  return cards.map((card) => ({ params: { path: card.path }, props: card }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderCard(props as OgCard);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Static output, so this only takes effect if the host honours it; the
      // filename changes with the slug, and a re-render of the same slug is a
      // new deploy anyway.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
