import { createClient } from '@supabase/supabase-js'
import { remark } from 'remark'
import html from 'remark-html'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Create Supabase client for server-side operations (static generation)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null

export type PostMeta = {
  slug: string
  title: string
  date: string
  tags?: string[]
  cover?: string
  excerpt?: string
  author?: string | null
}

export async function getAllPosts(): Promise<PostMeta[]> {
  if (!supabase) {
    console.warn('Supabase not configured, returning empty posts array')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('slug, title, date, excerpt, cover, cover_thumb, tags')
      .order('date', { ascending: false })

    if (error) {
      console.error('getAllPosts error:', error)
      return []
    }

    return (data || []).map((post) => ({
      slug: post.slug,
      title: post.title,
      date: post.date,
      tags: post.tags || [],
      cover: post.cover || null,
      excerpt: post.excerpt || ''
    }))
  } catch (e) {
    console.error('getAllPosts error', e)
    return []
  }
}

export async function getPostBySlug(slug: string) {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      throw new Error(`Post not found: ${slug}`)
    }

    // Process markdown body to HTML
    const processed = await remark().use(html).process(data.body || '')
    const contentHtml = processed.toString()

    return {
      slug: data.slug,
      meta: {
        title: data.title,
        date: data.date,
        tags: data.tags || [],
        cover: data.cover || null,
        excerpt: data.excerpt || '',
        author: (data.frontmatter && (data.frontmatter as any).author) || null
      },
      contentHtml
    }
  } catch (e: any) {
    console.error('getPostBySlug error', e)
    throw e
  }
}
