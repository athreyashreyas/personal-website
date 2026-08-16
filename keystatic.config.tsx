import { config, fields, collection, singleton } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';
import {
  STILL_LABELS,
  humanizeStillName,
  stillNameFromPath,
} from './src/lib/stills';
import { EMBED_LABELS, embedNameFromPath } from './src/lib/embeds';

// Project write-ups embed Astro components as bare <Xyz /> JSX tags. Keystatic's
// MDX editor needs every component used in content to be registered here, or it
// fails with "Missing component definition for X" the moment it tries to load an
// entry that uses one.
//
// `schema` is not optional detail: Keystatic validates every JSX attribute in
// the MDX against it, and an undeclared one fails the whole entry with
// `Key on object value "<prop>" is not allowed`. So a component's schema has to
// list every prop the content actually passes it — see EMBED_SCHEMAS below.
// The stills take none, hence the default.
function still(label: string, schema: Record<string, any> = {}) {
  const editable = Object.keys(schema).length > 0;
  return block({
    label,
    description: editable
      ? 'Renders on the live site. The fields below are its props.'
      : 'Renders on the live site — not editable here.',
    schema,
    ContentView: () => (
      <div
        style={{
          padding: '0.75rem 1rem',
          fontStyle: 'italic',
          opacity: 0.6,
          border: '1px dashed currentColor',
          borderRadius: 6,
        }}
      >
        {label}
      </div>
    ),
  });
}

// Every still that exists on disk gets a definition, so a newly added one can
// never be missing from here — that's what makes an entry fail to open. Names
// come from the files themselves; the readable labels come from
// src/lib/stills.ts, with a derived fallback if one hasn't been written yet.
const stillComponents = Object.fromEntries(
  Object.keys(import.meta.glob('./src/components/stills/*Still.astro'))
    .map(stillNameFromPath)
    .sort()
    .map((name) => [name, still(STILL_LABELS[name] ?? humanizeStillName(name))]),
);

/**
 * The props each interactive embed accepts, mirroring the `interface Props` in
 * its .astro file — same names, same defaults.
 *
 * Unlike the stills, the embeds are configured per use (<ServerSeesWidget> gets
 * a different sample note in Nila than in Hisaab), and Keystatic rejects any
 * attribute it hasn't been told about. An embed added here with props missing
 * from this map renders fine on the site but makes every entry that configures
 * it impossible to open in the CMS.
 */
const EMBED_SCHEMAS: Record<string, Record<string, any>> = {
  LatencyWidget: {
    aTtft: fields.number({ label: 'A — time to first token (ms)', defaultValue: 180 }),
    bTtft: fields.number({ label: 'B — time to first token (ms)', defaultValue: 1200 }),
    aTps: fields.number({ label: 'A — tokens per second', defaultValue: 45 }),
    bTps: fields.number({ label: 'B — tokens per second', defaultValue: 90 }),
    aLabel: fields.text({ label: 'A — name', defaultValue: 'A' }),
    bLabel: fields.text({ label: 'B — name', defaultValue: 'B' }),
    caption: fields.text({
      label: 'Caption',
      multiline: true,
      defaultValue:
        'A simulation of two timing profiles, not a live model call. Drag either slider to change its time to first token.',
    }),
  },
  LifeInWeeksWidget: {
    years: fields.number({ label: 'Life drawn, in years', defaultValue: 70 }),
    defaultBirthday: fields.text({ label: 'Starting birthday (yyyy-mm-dd)', defaultValue: '2001-09-17' }),
  },
  ServerSeesWidget: {
    sample: fields.text({
      label: 'Sample note',
      description: 'The kind of data this project would store — a cycle log, an expense.',
      defaultValue: 'Period started today. Cramps mild.',
    }),
  },
};

const embedComponents = Object.fromEntries(
  Object.keys(import.meta.glob('./src/components/embeds/*Widget.astro'))
    .map(embedNameFromPath)
    .sort()
    .map((name) => [
      name,
      still(EMBED_LABELS[name] ?? humanizeStillName(name), EMBED_SCHEMAS[name] ?? {}),
    ]),
);

const contentComponents = { ...stillComponents, ...embedComponents };

// The same embeds, offered to Lab items as a dropdown rather than a JSX tag.
// A Lab item is a structured record, not free MDX, so the widget is picked by
// name and rendered by src/pages/lab/index.astro — see the note on the `lab`
// singleton below for why that page stopped being one freeform document.
const widgetOptions = [
  { label: '— none —', value: '' },
  ...Object.keys(import.meta.glob('./src/components/embeds/*Widget.astro'))
    .map(embedNameFromPath)
    .sort()
    .map((name) => ({ label: EMBED_LABELS[name] ?? humanizeStillName(name), value: name })),
];

// Local storage: editing happens in `npm run dev` at /keystatic and writes
// files straight into this repo — no login, no database. To later edit from
// anywhere (incl. phone), switch `kind` to 'github' and add the GitHub app.
export default config({
  storage: { kind: 'local' },

  ui: {
    brand: { name: 'Shreyas — Site' },
  },

  singletons: {
    home: singleton({
      label: 'Home intro',
      path: 'src/content/home',
      format: { contentField: 'intro' },
      entryLayout: 'content',
      schema: {
        intro: fields.mdx({
          label: 'Intro',
          description: 'The short first-person intro shown on the home page.',
          options: {
            image: {
              directory: 'public/images/home',
              publicPath: '/images/home/',
            },
          },
        }),
      },
    }),

    /**
     * The Lab page: a freeform intro, then a list of discrete items.
     *
     * It used to be one MDX document with each thing written inline as an H2
     * plus a bare <XyzWidget /> tag. That reads fine but has no items in it —
     * nothing to reorder, and nothing to carry a date — so ordering the page
     * meant cutting and pasting prose. Items are structured records instead,
     * which Keystatic gives drag handles to for free.
     *
     * `body` is deliberately plain text, not fields.mdx. A nested mdx field
     * would be stored as a string in this file's frontmatter, and nothing on
     * the site can compile MDX at render time — the page would print the raw
     * markup. Item descriptions are a paragraph or two of prose; anything that
     * needs real formatting belongs in the intro, which is still full MDX.
     */
    lab: singleton({
      label: 'Lab page',
      path: 'src/content/lab',
      format: { contentField: 'intro' },
      entryLayout: 'content',
      schema: {
        intro: fields.mdx({
          label: 'Intro',
          description: 'The opening lines, above the list of things.',
          options: {
            image: {
              directory: 'public/images/lab',
              publicPath: '/images/lab/',
            },
          },
          components: contentComponents,
        }),
        manualOrder: fields.checkbox({
          label: 'Use manual order',
          description:
            'Off: newest first, by date added. On: the order the items are arranged in below.',
          defaultValue: false,
        }),
        items: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            date: fields.date({
              label: 'Date added',
              description: 'Orders the page when "Use manual order" is off.',
              defaultValue: { kind: 'today' },
            }),
            body: fields.text({
              label: 'Description',
              description: 'Plain prose. Leave a blank line between paragraphs.',
              multiline: true,
            }),
            widget: fields.select({
              label: 'Interactive block',
              description: 'Rendered underneath the description.',
              options: widgetOptions,
              defaultValue: '',
            }),
          }),
          {
            label: 'Things',
            description: 'Drag to rearrange — the order here is used when manual order is on.',
            itemLabel: (props) => props.fields.title.value || 'Untitled',
          },
        ),
      },
    }),

    about: singleton({
      label: 'About page',
      path: 'src/content/about',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        body: fields.mdx({
          label: 'About',
          description: 'The About page — first person. Headings, lists, links, images.',
          options: {
            image: {
              directory: 'public/images/about',
              publicPath: '/images/about/',
            },
          },
        }),
      },
    }),

    /**
     * Manual ordering for the two file-per-entry collections.
     *
     * Astro collections have no inherent order, and Keystatic can't drag-sort
     * entries that are separate files — so the arrangement lives here instead,
     * as a list of slugs per page. Both lists are partial on purpose: what's
     * listed is pinned to the top in that sequence, and everything else falls
     * in underneath by date added, newest first. An empty list is the default,
     * not a broken state.
     *
     * Deleting an entry leaves its slug behind here; src/lib/ordering.ts skips
     * ids it can't resolve rather than failing the build.
     *
     * Lab is absent because its items aren't a collection — they're an array
     * inside the Lab singleton, which drag-sorts on its own.
     */
    ordering: singleton({
      label: 'Ordering',
      path: 'src/content/ordering',
      format: { data: 'yaml' },
      schema: {
        writing: fields.array(fields.relationship({ label: 'Entry', collection: 'writing' }), {
          label: 'Writing',
          description:
            'Pinned to the top of /writing, in this order. Everything else follows, newest first.',
          itemLabel: (props) => props.value ?? 'Pick an entry',
        }),
        recommendations: fields.array(
          fields.relationship({ label: 'Entry', collection: 'recommendations' }),
          {
            label: 'Recommendations',
            description:
              'Pinned to the top of /recommendations, in this order. Everything else follows, newest first.',
            itemLabel: (props) => props.value ?? 'Pick an entry',
          },
        ),
      },
    }),
  },

  collections: {
    writing: collection({
      label: 'Writing',
      slugField: 'title',
      path: 'src/content/writing/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({
          name: { label: 'Title', description: 'The headline. Can carry a point of view.' },
        }),
        date: fields.date({
          label: 'Date',
          defaultValue: { kind: 'today' },
        }),
        dek: fields.text({
          label: 'Dek',
          description: 'Optional one-line summary shown in the list view.',
        }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
        }),
        draft: fields.checkbox({
          label: 'Draft',
          description: 'Hidden from the list and from the production build.',
          defaultValue: false,
        }),
        content: fields.mdx({
          label: 'Body',
          description: 'Write freely — headings, bold, lists, quotes, and images.',
          options: {
            image: {
              directory: 'public/images/writing',
              publicPath: '/images/writing/',
            },
          },
        }),
      },
    }),

    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'status'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          description: 'One-line summary — shown in the list and as the page lede.',
          multiline: true,
        }),
        status: fields.text({
          label: 'Status',
          description: 'Optional — e.g. active, in progress, archived, complete.',
        }),
        date: fields.date({
          label: 'Date',
          description: 'Used for ordering (newest first).',
          defaultValue: { kind: 'today' },
        }),
        links: fields.object(
          {
            repo: fields.url({ label: 'Repo URL' }),
            live: fields.url({ label: 'Live URL' }),
            doc: fields.url({
              label: 'Write-up URL',
              description: 'A doc, report, or deck that lives outside this site.',
            }),
          },
          { label: 'Links' },
        ),
        content: fields.mdx({
          label: 'Body',
          description: 'The write-up. Headings, bold, lists, quotes, and images.',
          options: {
            image: {
              directory: 'public/images/projects',
              publicPath: '/images/projects/',
            },
          },
          components: contentComponents,
        }),
      },
    }),

    /**
     * The controlled tag vocabulary, one entry per tag.
     *
     * `fields.slug` derives the filename from the label and enforces that no
     * two entries share one, which is the whole mechanism: "Public Policy",
     * "public policy" and "public  policy" all reduce to `public-policy`, so
     * the second attempt to create it is rejected and the existing tag gets
     * reused instead.
     */
    tags: collection({
      label: 'Tags',
      slugField: 'label',
      path: 'src/content/tags/*',
      format: { data: 'yaml' },
      columns: ['label'],
      schema: {
        label: fields.slug({
          name: {
            label: 'Tag',
            description: 'How it reads on the site — lower case, e.g. "public policy".',
          },
          slug: {
            label: 'ID',
            description:
              'The canonical form, generated from the tag. Recommendations store this, so ' +
              'changing it detaches every entry already using the tag.',
          },
        }),
      },
    }),

    recommendations: collection({
      label: 'Recommendations',
      slugField: 'title',
      path: 'src/content/recommendations/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      columns: ['title', 'category'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        url: fields.url({
          label: 'Link',
          description: 'Optional — where to find it.',
        }),
        category: fields.text({
          label: 'Category',
          description: 'Optional — e.g. Book, Article, Tool, Rabbit hole.',
        }),
        // Picked from the Tags collection rather than typed free-hand. The
        // picker searches what already exists, so one idea can't arrive as
        // "Public Policy" on one entry and "public policy" on the next.
        tags: fields.array(fields.relationship({ label: 'Tag', collection: 'tags' }), {
          label: 'Tags',
          description:
            'Search the tags that already exist. To use a new one, add it under Tags first.',
          itemLabel: (props) => props.value ?? 'Pick a tag',
        }),
        date: fields.date({
          label: 'Date added',
          description: 'Used for ordering (newest first).',
          defaultValue: { kind: 'today' },
        }),
        content: fields.mdx({
          label: 'Why / notes',
          description: 'What it is and why it is worth someone’s time.',
          options: {
            image: {
              directory: 'public/images/recommendations',
              publicPath: '/images/recommendations/',
            },
          },
        }),
      },
    }),
  },
});
