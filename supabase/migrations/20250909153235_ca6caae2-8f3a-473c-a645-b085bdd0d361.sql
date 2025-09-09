-- Create leads table for Isabella's conversation data
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  client_id TEXT DEFAULT 'solarclip' NOT NULL,
  session_id TEXT,
  source TEXT DEFAULT 'isabella_chat'
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to insert leads
CREATE POLICY "Anyone can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Create policy for authenticated users to view leads (admin access)
CREATE POLICY "Authenticated users can view all leads" 
ON public.leads 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create storage bucket for isabella media (cached content)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('isabella_media', 'isabella_media', false);

-- Create storage policies for isabella media
CREATE POLICY "Authenticated users can upload to isabella_media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'isabella_media' AND auth.role() = 'authenticated');

CREATE POLICY "Public read access to isabella_media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'isabella_media');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add index for faster lead queries
CREATE INDEX idx_leads_client_id ON public.leads(client_id);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_email ON public.leads(email);