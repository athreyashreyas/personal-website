import { config, fields, collection, singleton } from '@keystatic/core';

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
