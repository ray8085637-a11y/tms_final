-- Adding email recipients table for SendGrid integration
CREATE TABLE IF NOT EXISTS email_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all email recipients" ON email_recipients
  FOR SELECT USING (true);

CREATE POLICY "Users can insert email recipients" ON email_recipients
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update email recipients" ON email_recipients
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete email recipients" ON email_recipients
  FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_recipients_updated_at BEFORE UPDATE
    ON email_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
