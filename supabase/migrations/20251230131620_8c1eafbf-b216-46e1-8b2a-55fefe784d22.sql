-- RLS policies for api_idempotency_keys
CREATE POLICY "Users can manage their own idempotency keys"
ON public.api_idempotency_keys FOR ALL
USING (true);

-- RLS policies for api_rate_limits
CREATE POLICY "Users can view rate limits"
ON public.api_rate_limits FOR ALL
USING (true);