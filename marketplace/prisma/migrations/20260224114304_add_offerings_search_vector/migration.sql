-- Add column
ALTER TABLE "offerings"
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE "offerings"
SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B');

-- Create GIN index
CREATE INDEX IF NOT EXISTS offerings_search_vector_idx
ON "offerings"
USING GIN (search_vector);

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION offerings_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS offerings_search_vector_update ON "offerings";

-- Create trigger
CREATE TRIGGER offerings_search_vector_update
BEFORE INSERT OR UPDATE ON "offerings"
FOR EACH ROW EXECUTE FUNCTION offerings_search_vector_trigger();