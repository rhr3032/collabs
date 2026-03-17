
-- Fix: Remove overly permissive INSERT policy, replace with admin-only
DROP POLICY "Service role can insert payment history" ON public.payment_history;

-- Only admins can insert via client; edge functions use service role key which bypasses RLS
CREATE POLICY "Admins can insert payment history"
  ON public.payment_history FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
