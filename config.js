// Designed & developed by TheROMZ52 for KillZone Team — 2026
// اتصال به پروژه Supabase — این کلید anon عمومیه و مشکلی نداره تو کد سایت باشه
const SUPABASE_URL = 'https://fjzhkprnxznijwmjrlka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqemhrcHJueHpuaWp3bWpybGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMTQyOTksImV4cCI6MjEwMjc5MDI5OX0.5ruiJfuISuZ28NEMMSZ9XY3-UeKLOe99FLA2hT4wOEA';

// از CDN سوپابیس لود شده به اسم global "supabase" — کلاینتش رو با اسم sb می‌سازیم
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
