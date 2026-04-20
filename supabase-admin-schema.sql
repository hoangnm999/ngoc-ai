-- ═══════════════════════════════════════════════
-- ADMIN SCHEMA — thêm vào sau supabase-schema.sql
-- ═══════════════════════════════════════════════

-- Bảng admin users (tách khỏi profiles thường)
CREATE TABLE IF NOT EXISTS admins (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Thêm admin đầu tiên (thay YOUR_USER_UUID bằng UUID thật)
-- INSERT INTO admins (id) VALUES ('YOUR_USER_UUID');

-- View: thống kê tổng quan
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  (SELECT COUNT(*) FROM profiles)                                    AS total_users,
  (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days')  AS new_users_7d,
  (SELECT COUNT(*) FROM appraisals)                                  AS total_appraisals,
  (SELECT COUNT(*) FROM appraisals WHERE created_at > now() - interval '7 days') AS appraisals_7d,
  (SELECT COALESCE(SUM(amount_vnd),0) FROM transactions WHERE status='success') AS total_revenue_vnd,
  (SELECT COALESCE(SUM(amount_vnd),0) FROM transactions WHERE status='success' AND created_at > now() - interval '30 days') AS revenue_30d,
  (SELECT COUNT(*) FROM transactions WHERE status='pending')         AS pending_transactions,
  (SELECT COALESCE(SUM(xu),0) FROM profiles)                         AS total_xu_outstanding;

-- View: user list với stats
CREATE OR REPLACE VIEW admin_users AS
SELECT
  p.id, p.full_name, p.phone, p.xu,
  u.email, u.created_at,
  COUNT(DISTINCT a.id)  AS total_appraisals,
  COALESCE(SUM(t.amount_vnd) FILTER (WHERE t.status = 'success'), 0) AS total_spent_vnd,
  MAX(a.created_at)     AS last_appraisal_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN appraisals a ON a.user_id = p.id
LEFT JOIN transactions t ON t.user_id = p.id
GROUP BY p.id, p.full_name, p.phone, p.xu, u.email, u.created_at
ORDER BY u.created_at DESC;

-- View: daily revenue chart (last 30 days)
CREATE OR REPLACE VIEW admin_revenue_daily AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*)                       AS transaction_count,
  SUM(amount_vnd)                AS revenue_vnd,
  SUM(xu_added)                  AS xu_sold
FROM transactions
WHERE status = 'success' AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 1;

-- RLS: chỉ admin mới xem được
ALTER VIEW admin_stats OWNER TO postgres;
ALTER VIEW admin_users OWNER TO postgres;
ALTER VIEW admin_revenue_daily OWNER TO postgres;

-- Function kiểm tra admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE id = p_user_id);
$$ LANGUAGE sql SECURITY DEFINER;

-- Function: admin cộng xu thủ công
CREATE OR REPLACE FUNCTION admin_add_xu(p_admin_id UUID, p_user_id UUID, p_amount INT, p_note TEXT DEFAULT '')
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT is_admin(p_admin_id) THEN RETURN FALSE; END IF;
  UPDATE profiles SET xu = xu + p_amount, updated_at = now() WHERE id = p_user_id;
  INSERT INTO transactions (user_id, amount_vnd, xu_added, package_id, payment_method, status, payment_raw)
  VALUES (p_user_id, 0, p_amount, 'manual', 'admin', 'success', jsonb_build_object('note', p_note, 'by', p_admin_id));
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
