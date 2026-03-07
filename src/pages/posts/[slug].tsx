// src/pages/posts/[slug].tsx
import { GetStaticPaths, GetStaticProps } from "next";
import { getAllPosts, getPostBySlug } from "@/lib/posts";
import Layout from "@/components/Layout";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

export default function Post({ post }: any) {
  const cover = post.meta?.cover || post.meta?.coverThumb || null;
  return (
    <Layout>
      <Head><title>{post.meta.title} — Aurora 2.0</title></Head>
      <main className="container mx-auto px-4 py-6 md:py-10">
        {/* Use a visual wrapper class plus the prose classes directly on the element */}
        <article className="article-wrapper prose prose-sm sm:prose-base md:prose-lg lg:prose-xl prose-slate max-w-none">
          <h1>{post.meta.title}</h1>
          <p className="text-sm text-slate-400">{post.meta.date}</p>

          {post.meta.tags && post.meta.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {post.meta.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 no-underline"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {cover && (
            <div className="w-full my-6 md:my-8 flex justify-center">
              <div className="w-full max-w-3xl px-2 md:px-4">
                <div className="rounded-xl md:rounded-2xl overflow-hidden bg-[#fdf9ff] border border-[color:var(--border)] shadow-sm">
                  <Image
                    src={cover}
                    alt={post.meta.title}
                    width={1000}
                    height={650}
                    className="w-full h-auto object-contain"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 92vw, (max-width: 1200px) 82vw, 1000px"
                    priority={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* rendered HTML from markdown --- keep the wrapper 'prose' on this parent */}
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </article>
      </main>
    </Layout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getAllPosts();
  const paths = posts.map((p: any) => ({ params: { slug: p.slug } }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { slug } = context.params as { slug: string };
  const post = await getPostBySlug(slug);
  return { props: { post } };
};
