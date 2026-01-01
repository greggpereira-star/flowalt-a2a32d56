-- STEP 1: Criar ENUMs
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.plan_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
CREATE TYPE public.billing_provider AS ENUM ('manual', 'stripe');