-- Add city, area, and notification_preferences to public.profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email_alerts":true,"report_updates":true,"community_announcements":true}'::jsonb;
