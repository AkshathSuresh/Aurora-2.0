import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { getAllPosts, PostMeta } from "@/lib/posts";
import PostCard from "@/components/PostCard";

type Props = {
  tag: string;
  posts: PostMeta[];
};

export default function TagPage({ tag, posts }: Props) {
  return (
    <Layout>
      <Head>
        <title>Posts tagged “{tag}” — Aurora 2.0</title>
      </Head>
      <main className="container mx-auto px-4 py-6 md:py-10">
        <div className="mb-4 md:mb-6">
          <Link href="/tags" className="text-xs md:text-sm text-slate-500 hover:underline">
            ← All tags
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Tag: {tag}</h1>
        <p className="text-sm md:text-base text-slate-600 mb-4 md:mb-6">
          Showing {posts.length} post{posts.length === 1 ? "" : "s"} tagged with "{tag}".
        </p>

        {posts.length === 0 ? (
          <p className="text-slate-500">No posts found for this tag.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3 md:grid-cols-2">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts();
  const tagSet = new Set<string>();

  for (const p of posts) {
    const tags = (p.tags || []).map((t) => String(t).trim()).filter(Boolean);
    tags.forEach((t) => tagSet.add(t));
  }

  const paths = Array.from(tagSet).map((tag) => ({
    params: { tag: encodeURIComponent(tag) },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const rawParam = (context.params as { tag: string }).tag;
  const tag = decodeURIComponent(rawParam);

  const all = await getAllPosts();
  const posts = all.filter((p) =>
    (p.tags || []).some((t) => String(t).trim().toLowerCase() === tag.trim().toLowerCase())
  );

  return { props: { tag, posts }, revalidate: 60 };
};


