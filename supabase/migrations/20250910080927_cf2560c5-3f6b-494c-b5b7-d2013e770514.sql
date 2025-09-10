-- Create user roles system for secure lead access
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Add user_id to leads table for ownership tracking
ALTER TABLE public.leads ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Update leads RLS policies for secure access
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;

-- Only admins can view all leads, regular users can only view their own
CREATE POLICY "Admins can view all leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Only admins can insert leads (Isabella chat creates leads)
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

CREATE POLICY "Admins can insert leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow service role to insert leads (for edge functions)
CREATE POLICY "Service role can insert leads" 
ON public.leads 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert a default admin user (replace with actual admin user ID when known)
-- Users will need to manually assign admin role to their first user
COMMENT ON TABLE public.user_roles IS 'After creating your first user account, manually assign admin role: INSERT INTO public.user_roles (user_id, role) VALUES (''your-user-id'', ''admin'');';