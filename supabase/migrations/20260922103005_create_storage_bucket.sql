/*
# Create report-media storage bucket

## Purpose
Creates a public storage bucket for report evidence images and videos.
The bucket is public so that uploaded files can be accessed via public URLs.

## Changes
- Creates storage bucket 'report-media' if it doesn't exist
- Sets it as public (anyone with the URL can read)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-media', 'report-media', true)
ON CONFLICT (id) DO NOTHING;