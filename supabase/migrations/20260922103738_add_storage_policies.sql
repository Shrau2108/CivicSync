/*
# Add storage policies for report-media bucket

## Purpose
The 'report-media' bucket stores report evidence images/videos and task before/after evidence.
The bucket is public (readable via URL) so the frontend can display images in <img> tags.
This migration adds policies to control who can upload and delete files.

## Policies
1. Public read — anyone can read files (required for getPublicUrl)
2. Authenticated upload — any signed-in user can upload
3. Staff delete — supervisors and admins can delete files

## Security
- Unauthenticated users CANNOT upload or delete
- Authenticated users CAN upload (needed for evidence submission)
- Only staff can delete files (citizens delete via DB-level cascade)
- Reads are public (bucket is public for getPublicUrl compatibility)
*/

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "report_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "report_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "report_media_staff_delete" ON storage.objects;

-- Policy 1: Public read
CREATE POLICY "report_media_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'report-media');

-- Policy 2: Authenticated upload
CREATE POLICY "report_media_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-media');

-- Policy 3: Staff-only delete
CREATE POLICY "report_media_staff_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin')
  )
);