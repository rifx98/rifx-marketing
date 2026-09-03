-- 030_secure_credit_recharge.sql

-- Add RPC function to securely increment AI credits
CREATE OR REPLACE FUNCTION increment_ai_credits(
  p_tenant_id uuid,
  p_amount numeric,
  p_note text,
  p_user_id uuid
) RETURNS numeric AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Lock the row to prevent race conditions
  UPDATE public.tenants
  SET ai_credits_balance = ai_credits_balance + p_amount
  WHERE id = p_tenant_id
  RETURNING ai_credits_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Insert into ledger
  INSERT INTO public.ai_credit_ledger (
    tenant_id,
    type,
    amount,
    balance_after,
    reference,
    created_by
  ) VALUES (
    p_tenant_id,
    'adjustment',
    p_amount,
    v_new_balance,
    p_note,
    p_user_id
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
