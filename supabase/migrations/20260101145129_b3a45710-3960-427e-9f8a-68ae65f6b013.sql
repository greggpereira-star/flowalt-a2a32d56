-- STEP 1.1: Add is_system column to spaces
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Mark Clientes space as systemic (based on name pattern)
UPDATE public.spaces 
SET is_system = true 
WHERE name ILIKE '%cliente%';

-- STEP 1.2: Create optimized indices
CREATE INDEX IF NOT EXISTS idx_spaces_workspace_sort 
ON public.spaces(workspace_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_spaces_workspace_archived 
ON public.spaces(workspace_id, is_archived);

-- STEP 1.3: Create fix_space_order function
CREATE OR REPLACE FUNCTION public.fix_space_order(p_workspace_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, created_at) - 1 AS new_order
    FROM public.spaces
    WHERE workspace_id = p_workspace_id AND is_archived = false
  )
  UPDATE public.spaces s
  SET sort_order = o.new_order::INTEGER, updated_at = now()
  FROM ordered o
  WHERE s.id = o.id AND s.sort_order != o.new_order;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 1.4: Create reorder_spaces RPC (atomic + audit + event)
CREATE OR REPLACE FUNCTION public.reorder_spaces(
  p_workspace_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_space_id UUID;
  v_new_order INTEGER;
  v_old_data JSONB;
  v_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_space_id := (v_item->>'id')::UUID;
    v_new_order := (v_item->>'sort_order')::INTEGER;
    
    -- Capture previous state
    SELECT to_jsonb(s.*) INTO v_old_data
    FROM public.spaces s
    WHERE s.id = v_space_id AND s.workspace_id = p_workspace_id;
    
    -- Skip if space not found in this workspace
    IF v_old_data IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Update sort_order
    UPDATE public.spaces
    SET sort_order = v_new_order, updated_at = now()
    WHERE id = v_space_id AND workspace_id = p_workspace_id;
    
    -- Audit log
    INSERT INTO public.audit_logs (workspace_id, user_id, action, entity_type, entity_id, old_data, new_data, metadata)
    VALUES (
      p_workspace_id,
      v_user_id,
      'reordered',
      'space',
      v_space_id::TEXT,
      v_old_data,
      jsonb_build_object('sort_order', v_new_order),
      jsonb_build_object('reason', p_reason)
    );
    
    -- Domain event
    INSERT INTO public.domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload, metadata)
    VALUES (
      p_workspace_id,
      'SpaceReordered',
      'Space',
      v_space_id::TEXT,
      jsonb_build_object('old_order', (v_old_data->>'sort_order')::INTEGER, 'new_order', v_new_order),
      jsonb_build_object('actor_user_id', v_user_id, 'reason', p_reason)
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Normalize order
  PERFORM public.fix_space_order(p_workspace_id);
  
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 1.5: Fix sort_order for all existing workspaces
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT DISTINCT workspace_id FROM public.spaces
  LOOP
    PERFORM public.fix_space_order(ws.workspace_id);
  END LOOP;
END $$;