import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const postsDir = path.join(process.cwd(), 'content', 'posts')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))
    return res.status(200).json(files)
  }

  if (req.method === 'POST') {
    const { slug, frontmatter, body } = req.body
    if (!slug || !frontmatter) return res.status(400).json({ error: 'missing fields' })
    const fmEncoded = frontmatter.replace(/```/g, '``') // naive safety
    const content = `---\n${fmEncoded}\n---\n\n${body || ''}`
    const filename = slug.endsWith('.md') ? slug : `${slug}.md`
    fs.writeFileSync(path.join(postsDir, filename), content, 'utf8')
    return res.status(201).json({ ok: true })
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
