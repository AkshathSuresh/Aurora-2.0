-- Run this SQL in your Supabase SQL Editor to create the posts table
-- This table will store all published blog posts

CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  body TEXT NOT NULL,
  frontmatter JSONB DEFAULT '{}'::jsonb,
  cover TEXT,
  cover_thumb TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read posts (public access)
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete (you'll need to set up auth)
-- For now, we'll use service role key in API routes, so this is permissive
-- You can tighten this later with proper auth checks
CREATE POLICY "Admins can manage posts" ON posts
  FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
