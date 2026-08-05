import { config, fields, collection, singleton } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';
import {
  STILL_LABELS,
  humanizeStillName,
  stillNameFromPath,
} from './src/lib/stills';

// Project write-ups embed Astro "still" components (screenshot mock-ups) as
// bare <XyzStill /> JSX tags. Keystatic's MDX editor needs every component
// used in content to be registered here — none take props, they're purely
// visual on the live site — otherwise it fails with "Missing component
// definition for X" the moment it tries to load an entry that uses one.
function still(label: string) {
  return block({
    label,
    description: 'Renders on the live site — not editable here.',
    schema: {},
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
          components: stillComponents,
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
