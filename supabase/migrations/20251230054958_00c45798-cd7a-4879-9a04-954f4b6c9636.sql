-- Create rate limiting table
CREATE TABLE public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(api_key_id, window_start)
);

-- Create idempotency keys table
CREATE TABLE public.api_idempotency_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_path TEXT NOT NULL,
  request_method TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  UNIQUE(workspace_id, idempotency_key)
);

-- Create indexes
CREATE INDEX idx_rate_limits_key_window ON public.api_rate_limits(api_key_id, window_start);
CREATE INDEX idx_idempotency_expires ON public.api_idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_lookup ON public.api_idempotency_keys(workspace_id, idempotency_key);

-- Enable RLS (service role will bypass)
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_api_key_id UUID,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, reset_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
BEGIN
  -- Calculate current window start (truncate to minute)
  v_window_start := date_trunc('minute', now());
  
  -- Try to insert or update the rate limit record
  INSERT INTO public.api_rate_limits (api_key_id, window_start, request_count)
  VALUES (p_api_key_id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Clean up old rate limit records (older than 5 minutes)
  DELETE FROM public.api_rate_limits 
  WHERE window_start < now() - INTERVAL '5 minutes';
  
  -- Return result
  RETURN QUERY SELECT 
    v_current_count <= p_max_requests,
    v_current_count,
    v_window_start + (p_window_minutes || ' minutes')::INTERVAL;
END;
$$;

-- Function to check idempotency key
CREATE OR REPLACE FUNCTION public.get_idempotent_response(
  p_workspace_id UUID,
  p_idempotency_key TEXT
)
RETURNS TABLE(found BOOLEAN, response_status INTEGER, response_body JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean up expired keys
  DELETE FROM public.api_idempotency_keys WHERE expires_at < now();
  
  -- Look for existing response
  RETURN QUERY
  SELECT 
    TRUE,
    ik.response_status,
    ik.response_body
  FROM public.api_idempotency_keys ik
  WHERE ik.workspace_id = p_workspace_id 
    AND ik.idempotency_key = p_idempotency_key
    AND ik.expires_at > now();
  
  -- If no rows returned, return not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::JSONB;
  END IF;
END;
$$;

-- Function to store idempotent response
CREATE OR REPLACE FUNCTION public.store_idempotent_response(
  p_workspace_id UUID,
  p_idempotency_key TEXT,
  p_request_path TEXT,
  p_request_method TEXT,
  p_response_status INTEGER,
  p_response_body JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.api_idempotency_keys (
    workspace_id, 
    idempotency_key, 
    request_path, 
    request_method, 
    response_status, 
    response_body
  )
  VALUES (
    p_workspace_id, 
    p_idempotency_key, 
    p_request_path, 
    p_request_method, 
    p_response_status, 
    p_response_body
  )
  ON CONFLICT (workspace_id, idempotency_key) DO NOTHING;
END;
$$;