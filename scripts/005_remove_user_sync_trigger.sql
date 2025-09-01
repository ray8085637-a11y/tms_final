-- Remove the user sync trigger that's causing the "Database error saving new user" issue
-- This will allow basic Supabase Auth to work properly

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Drop the trigger function
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_user();

-- We'll implement user data sync differently after basic auth works
