/**
 * Drop removed support_tickets columns on existing master_db installs.
 * Safe to re-run (IF EXISTS).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { masterQuery } = require('../src/config/database');

async function main() {
  console.log('Dropping removed support_tickets / help_categories columns...');
  await masterQuery(`
    ALTER TABLE public.support_tickets
      DROP COLUMN IF EXISTS created_by_name,
      DROP COLUMN IF EXISTS created_by_email,
      DROP COLUMN IF EXISTS assigned_super_admin_id,
      DROP COLUMN IF EXISTS resolved_at,
      DROP COLUMN IF EXISTS tags;
    ALTER TABLE public.help_categories
      DROP COLUMN IF EXISTS icon;
    ALTER TABLE public.help_articles
      DROP COLUMN IF EXISTS slug;
    DROP INDEX IF EXISTS public.idx_help_articles_tags;
    ALTER TABLE public.help_articles
      DROP CONSTRAINT IF EXISTS chk_help_article_visibility;
    ALTER TABLE public.help_articles
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS visibility,
      DROP COLUMN IF EXISTS view_count;
    ALTER TABLE public.help_faqs
      DROP COLUMN IF EXISTS tags;
  `);
  const cols = await masterQuery(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'support_tickets'
     ORDER BY ordinal_position`
  );
  console.log('support_tickets columns:', cols.rows.map((r) => r.column_name).join(', '));
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
