-- Add updated_at column to detected_skills table
ALTER TABLE detected_skills 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS update_detected_skills_updated_at ON detected_skills;

CREATE TRIGGER update_detected_skills_updated_at 
BEFORE UPDATE ON detected_skills 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();