import { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { getAllPosts, PostMeta } from "@/lib/posts";

type Props = {
  tags: { name: string; count: number }[];
};

export default function TagsIndex({ tags }: Props) {
  return (
    <Layout>
      <Head>
        <title>Browse Tags — Aurora 2.0</title>
      </Head>
      <main className="container mx-auto px-4 py-6 md:py-10">
        <section className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4">Browse by Tag</h1>
          <p className="text-sm md:text-base text-slate-600 mb-4 md:mb-6">
            Explore stories by topic. Click a tag to see all posts that mention it.
          </p>

          {tags.length === 0 ? (
            <p className="text-slate-500">No tags yet. Create a post with tags from the Admin page.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/tags/${encodeURIComponent(tag.name)}`}
                  className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100"
                >
                  {tag.name}
                  <span className="ml-2 text-xs text-emerald-900/70">{tag.count}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getAllPosts();
  const counts = new Map<string, number>();

  for (const p of posts) {
    const tags = (p.tags || []).map((t) => String(t).trim()).filter(Boolean);
    for (const t of tags) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }

  const tags = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { props: { tags }, revalidate: 60 };
};


