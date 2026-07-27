import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Keystatic writes empty optional fields as "" — normalize those to undefined
// so validation stays happy whether a file is hand-written or CMS-authored.
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    dek: optionalString,
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: optionalString,
    links: z
      .object({
        repo: optionalUrl,
        live: optionalUrl,
      })
      .default({}),
    date: z.coerce.date().optional(),
  }),
});

const recommendations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recommendations' }),
  schema: z.object({
    title: z.string(),
    url: optionalUrl,
    category: optionalString,
    date: z.coerce.date(),
  }),
});

// Editable single pages (e.g. the home intro), managed as Keystatic singletons.
// The `home` singleton writes to src/content/home.mdx.
const pages = defineCollection({
  loader: glob({ pattern: 'home.mdx', base: './src/content' }),
  schema: z.object({}),
});

export const collections = { writing, projects, recommendations, pages };
