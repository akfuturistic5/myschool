-- Global Scalable Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id integer NOT NULL PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  setting_key character varying(255) NOT NULL UNIQUE,
  setting_value text,
  setting_group character varying(255),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_group ON public.settings (setting_group);
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings (setting_key);
