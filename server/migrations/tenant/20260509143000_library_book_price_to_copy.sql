-- Move price from bibliographic record (library_books) to physical copy (library_book_copies).

ALTER TABLE public.library_book_copies
  ADD COLUMN IF NOT EXISTS copy_price numeric(10,2);

UPDATE public.library_book_copies bc
SET copy_price = b.book_price
FROM public.library_books b
WHERE b.id = bc.book_id
  AND bc.copy_price IS NULL
  AND b.book_price IS NOT NULL;

ALTER TABLE public.library_books
  DROP COLUMN IF EXISTS book_price;
