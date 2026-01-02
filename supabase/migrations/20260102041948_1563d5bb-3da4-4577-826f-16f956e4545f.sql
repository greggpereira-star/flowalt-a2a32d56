-- ENTITLEMENTS for notices module (correct columns)
INSERT INTO public.entitlement_registry (key, name, description, type, default_enabled, default_limit)
VALUES ('notices_management', 'Notices Management', 'Ability to create and manage internal notices', 'boolean', true, NULL),
       ('birthday_visibility', 'Birthday Visibility', 'Ability to configure birthday visibility settings', 'boolean', true, NULL)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled)
VALUES ('free', 'notices_management', true), ('pro', 'notices_management', true), ('enterprise', 'notices_management', true),
       ('free', 'birthday_visibility', true), ('pro', 'birthday_visibility', true), ('enterprise', 'birthday_visibility', true)
ON CONFLICT (plan_key, entitlement_key) DO NOTHING;