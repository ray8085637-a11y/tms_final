-- Fix RLS policy for users table to allow new user registration

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create a new INSERT policy that allows authenticated users to create their profile
-- with the correct user ID from auth.uid()
CREATE POLICY "Authenticated users can create their profile" ON public.users
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND 
        id = auth.uid()
    );

-- Also add a policy to allow service role to insert users (for admin operations)
CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' = 'service_role'
    );
