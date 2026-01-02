-- =============================================
-- FIX: Align spaces_limit values between plan_entitlements and seed trigger
-- =============================================

-- Update plan_entitlements to match the trigger value (3 for free)
UPDATE plan_entitlements 
SET limit_value = 3 
WHERE plan_key = 'free' AND entitlement_key = 'spaces_limit';

-- Update entitlement_registry default to 3 as well
UPDATE entitlement_registry 
SET default_limit = 3 
WHERE key = 'spaces_limit';

-- Also ensure seats_limit is consistent
UPDATE plan_entitlements 
SET limit_value = 3 
WHERE plan_key = 'free' AND entitlement_key = 'seats_limit';

-- Verify the update
SELECT plan_key, entitlement_key, limit_value 
FROM plan_entitlements 
WHERE entitlement_key = 'spaces_limit';