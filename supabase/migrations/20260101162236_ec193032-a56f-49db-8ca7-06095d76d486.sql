
-- =====================================================
-- BLUEPRINT GOVERNANCE: STEP 1 - Add 'finance' role
-- Must be in separate transaction before using it
-- =====================================================

-- STEP 1: Add 'finance' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance' AFTER 'coordinator';
