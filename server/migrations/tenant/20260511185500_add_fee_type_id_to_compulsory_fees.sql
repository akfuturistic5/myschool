-- Add fee_type_id to compulsory_fees to track specific fee types for yearly (non-installment) payments
ALTER TABLE public.compulsory_fees 
ADD COLUMN fee_type_id INTEGER REFERENCES public.fees_types(id);

-- Also add it to optional_fees if it's missing (though optional_fees already links to fees_class_types)
-- Actually, optional_fees already has fee_class_type_id, which we can join to get fee_type_id.
