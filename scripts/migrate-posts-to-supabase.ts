/**
 * Migration script to move existing markdown posts from filesystem to Supabase
 * 
 * Run this script once to migrate your existing posts:
 * npx tsx scripts/migrate-posts-to-supabase.ts
 * 
 * Or use ts-node:
 * npx ts-node scripts/migrate-posts-to-supabase.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const postsDir = path.join(process.cwd(), 'content', 'posts')

async function migratePosts() {
  console.log('Starting migration of posts from filesystem to Supabase...\n')

  try {
    // Read all markdown files
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))
    console.log(`Found ${files.length} post(s) to migrate\n`)

    let successCount = 0
    let errorCount = 0

    for (const fileName of files) {
      try {
        const slug = fileName.replace(/\.md$/, '')
        const fullPath = path.join(postsDir, fileName)
        const fileContents = fs.readFileSync(fullPath, 'utf8')
        const parsed = matter(fileContents)
        const meta = parsed.data || {}

        // Extract tags
        let tags: string[] = []
        if (meta.tags) {
          if (Array.isArray(meta.tags)) {
            tags = meta.tags
          } else if (typeof meta.tags === 'string') {
            tags = meta.tags.split(',').map(t => t.trim()).filter(Boolean)
          }
        }

        const postData = {
          slug,
          title: String(meta.title || slug),
          date: String(meta.date || new Date().toISOString().slice(0, 10)),
          excerpt: String(meta.excerpt || ''),
          body: parsed.content || '',
          frontmatter: meta as any,
          cover: meta.cover || null,
          cover_thumb: meta.coverThumb || meta.cover_thumb || null,
          tags,
        }

        // Check if post already exists
        const { data: existing } = await supabase
          .from('posts')
          .select('slug')
          .eq('slug', slug)
          .single()

        if (existing) {
          console.log(`⚠️  Post "${slug}" already exists in Supabase, skipping...`)
          continue
        }

        // Insert into Supabase
        const { data, error } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single()

        if (error) {
          console.error(`❌ Error migrating "${slug}":`, error.message)
          errorCount++
        } else {
          console.log(`✅ Migrated "${slug}"`)
          successCount++
        }
      } catch (err: any) {
        console.error(`❌ Error processing "${fileName}":`, err.message)
        errorCount++
      }
    }

    console.log(`\n✅ Migration complete!`)
    console.log(`   Success: ${successCount}`)
    console.log(`   Errors: ${errorCount}`)
    console.log(`\n💡 You can now safely delete the ${postsDir} directory if you want.`)
    console.log(`   (Keep a backup first, just in case!)`)
  } catch (err: any) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

migratePosts()
