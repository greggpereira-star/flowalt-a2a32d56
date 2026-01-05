-- Make card_id optional in social_posts (allows creating posts without linking to a card)
ALTER TABLE public.social_posts 
ALTER COLUMN card_id DROP NOT NULL;