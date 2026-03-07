// src/pages/index.tsx
import { GetStaticProps } from "next";
import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import { getAllPosts, PostMeta } from "@/lib/posts";

type Props = { posts: PostMeta[] };

export default function Home({ posts }: Props) {
  // sort by date descending (newest first) and pick a featured post
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
  const featured = sorted[0];
  const others = sorted.slice(1);

  const tagCounts = new Map<string, number>();
  for (const p of posts) {
    const tags = (p.tags || []).map((t) => String(t).trim()).filter(Boolean);
    for (const t of tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const popularTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);

  return (
    <Layout>
      <Head>
        <title>Aurora 2.0 — Nature & Photography Club</title>
        <meta name="description" content="Nature photography & stories from club members." />
      </Head>

      <section className="container mx-auto px-4 py-6 md:py-12">
        {/* Hero / Intro */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-10">
          <div className="lg:col-span-2">
            <div className="hero p-4 md:p-8 rounded-2xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
                Nature & Photography Club
              </h1>
              <p className="mt-3 text-base md:text-lg text-slate-600 max-w-2xl">
                Nature photography & stories from club members — discover recent captures, and field notes from our community.
              </p>

              <div className="mt-4 md:mt-6 flex items-center gap-3">
                <Link href="/tags"
                  className="btn btn-ghost text-sm md:text-base">Browse Tags
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4 md:space-y-6">
            <div className="card p-4 md:p-5">
              <h4 className="font-semibold text-base md:text-lg mb-2">Latest</h4>
              {featured ? (
                <Link href={`/posts/${featured.slug}`}
                  className="flex items-start gap-3">
                    <div className="w-20 h-20 rounded-md overflow-hidden bg-slate-50">
                      {featured.cover ? (
                        <Image
                          src={featured.cover}
                          alt={featured.title}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">No</div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-800">{featured.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{featured.date}</div>
                    </div>
                  
                </Link>
              ) : (
                <div className="text-sm text-slate-500">No posts yet.</div>
              )}
            </div>

            <div className="card p-4 md:p-5">
              <h4 className="font-semibold mb-3 text-base md:text-lg">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {popularTags.length === 0 ? (
                  <span className="text-xs text-slate-400">Tags will appear here once posts have tags.</span>
                ) : (
                  popularTags.map((tag) => (
                    <Link
                      key={tag.name}
                      href={`/tags/${encodeURIComponent(tag.name)}`}
                      className="text-xs px-3 py-1 rounded-full bg-aurora-100 text-aurora-700"
                    >
                      {tag.name}
                    </Link>
                  ))
                )}
              </div>
            </div>

          </aside>
        </div>

        {/* Posts grid */}
        <div className="grid gap-6 lg:grid-cols-3 md:grid-cols-2">
          {others.length === 0 ? (
            <p className="text-slate-500">No other posts yet — check back soon.</p>
          ) : (
            others.map((p) => <PostCard key={p.slug} post={p} />)
          )}
        </div>

        {/* Footer CTA */}
        
      </section>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getAllPosts();
  return { props: { posts } };
};

