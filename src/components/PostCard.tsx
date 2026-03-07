// src/components/PostCard.tsx
import Link from "next/link";
import Image from "next/image";
import { PostMeta } from "@/lib/posts";

export default function PostCard({ post }: { post: PostMeta }) {
  const coverThumb = (post as any).coverThumb || null;
  const cover = coverThumb || (post as any).cover || null; // fall back to full cover if no thumb

  return (
    <article className="card transition-transform transform hover:-translate-y-1 hover:shadow-aurora-md bg-white border border-[color:var(--border)]">

      {/* IMAGE OR NATURE PLACEHOLDER */}
      <div className="relative w-full aspect-[3/2] bg-white rounded-t-xl overflow-hidden flex items-center justify-center">
        {cover ? (
          <Image
            src={cover}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width:768px) 100vw, 33vw"
          />
        ) : (
          // 🌿 NATURE ILLUSTRATION PLACEHOLDER
          <div className="w-full bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center px-6 py-8">

            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 240"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="auroraSky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dfffe8" />
                  <stop offset="70%" stopColor="#a8e6b1" />
                </linearGradient>

                <linearGradient id="mountain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7bc89c" />
                  <stop offset="100%" stopColor="#4fa373" />
                </linearGradient>

                <linearGradient id="mountain2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5aa681" />
                  <stop offset="100%" stopColor="#3d7c5d" />
                </linearGradient>
              </defs>

              {/* SKY */}
              <rect width="400" height="240" fill="url(#auroraSky)" />

              {/* SUN */}
              <circle cx="310" cy="60" r="28" fill="#ffee88" opacity="0.85" />

              {/* BACK MOUNTAINS */}
              <path
                d="M0 180 L80 120 L140 165 L220 90 L300 160 L400 110 L400 240 L0 240 Z"
                fill="url(#mountain)"
              />

              {/* FRONT MOUNTAINS */}
              <path
                d="M0 200 L90 150 L180 200 L260 130 L350 190 L400 170 L400 240 L0 240 Z"
                fill="url(#mountain2)"
                opacity="0.9"
              />

              {/* EVERGREEN TREES */}
              <g fill="#2e6b4c" opacity="0.85">
                <rect x="60" y="150" width="6" height="25" />
                <polygon points="63 130 50 155 76 155" />

                <rect x="300" y="150" width="6" height="25" />
                <polygon points="303 130 290 155 316 155" />
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* CARD BODY */}
      <div className="p-5">
        <h3 className="text-lg font-semibold leading-snug">
          <Link
            href={`/posts/${post.slug}`}
            className="hover:text-[color:var(--brand)]"
          >
            {post.title}
          </Link>
        </h3>

        <p className="text-sm text-slate-500 mt-2 line-clamp-3">{post.excerpt}</p>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <time className="text-xs text-slate-400">{post.date}</time>
          <Link
            href={`/posts/${post.slug}`}
            className="text-sm text-[color:var(--brand)] hover:underline"
          >
            Read →
          </Link>
        </div>
      </div>
    </article>
  );
}
