// Designed & developed by TheROMZ52 for KillZone Team — 2026
// Client-side Supabase connection. The publishable key is safe for browser use when RLS protects exposed data.
const SUPABASE_URL = 'https://fjzhkprnxznijwmjrlka.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OeU6Z8Yn_rPuxfKRsMApqw__kcMQIKA';

// Supabase is loaded from CDN as the global "supabase" object; expose the project client as "sb".
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
