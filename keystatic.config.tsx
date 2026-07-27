import { config, fields, collection } from '@keystatic/core';

// Local storage: editing happens in `npm run dev` at /keystatic and writes
// files straight into this repo — no login, no database. To later edit from
// anywhere (incl. phone), switch `kind` to 'github' and add the GitHub app.
export default config({
  storage: { kind: 'local' },

  ui: {
    brand: { name: 'Shreyas — Site' },
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
  },
});
