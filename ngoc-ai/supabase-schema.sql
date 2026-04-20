-- ═══════════════════════════════════════════════
-- NGOC AI — Supabase Schema
-- Chạy từng block trong Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- 1. Profiles (mở rộng auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name     TEXT,
  phone         TEXT,
  xu            INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Tự động tạo profile khi user đăng ký
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, xu)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    2  -- 2 xu miễn phí khi đăng ký
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Transactions (lịch sử nạp tiền)
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  amount_vnd      INT NOT NULL,
  xu_added        INT NOT NULL,
  package_id      TEXT NOT NULL,           -- 'basic' | 'standard' | 'pro'
  payment_method  TEXT NOT NULL,           -- 'vnpay' | 'momo'
  payment_ref     TEXT,                    -- Mã GD từ cổng thanh toán
  payment_raw     JSONB,                   -- Raw response từ cổng (để audit)
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'success'|'failed'
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index để tra cứu nhanh theo user
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);

-- 3. Appraisals (lịch sử định giá)
CREATE TABLE IF NOT EXISTS appraisals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  xu_used               INT NOT NULL DEFAULT 2,
  images_count          INT NOT NULL,
  has_video             BOOLEAN DEFAULT false,
  -- Kết quả từng AI
  result_sonnet         JSONB,
  result_haiku          JSONB,
  result_gemini         JSONB,
  -- Kết quả tổng hợp
  consensus_grade       TEXT,
  consensus_price_low   BIGINT,
  consensus_price_high  BIGINT,
  consensus_confidence  INT,               -- 0-100%
  stone_type            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appraisals_user_id   ON appraisals(user_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_created   ON appraisals(created_at DESC);

-- 4. Row Level Security
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisals   ENABLE ROW LEVEL SECURITY;

-- Profiles: chỉ đọc/sửa của mình
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Transactions: chỉ xem của mình
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Appraisals: chỉ xem của mình
CREATE POLICY "Users can view own appraisals"
  ON appraisals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appraisals"
  ON appraisals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Helper function: trừ xu an toàn (atomic)
CREATE OR REPLACE FUNCTION deduct_xu(p_user_id UUID, p_amount INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_xu INT;
BEGIN
  SELECT xu INTO current_xu FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF current_xu < p_amount THEN
    RETURN FALSE;
  END IF;
  UPDATE profiles SET xu = xu - p_amount, updated_at = now() WHERE id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper function: cộng xu + tạo transaction thành công
CREATE OR REPLACE FUNCTION complete_payment(
  p_transaction_id UUID,
  p_payment_ref    TEXT,
  p_payment_raw    JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id  UUID;
  v_xu       INT;
  v_status   TEXT;
BEGIN
  SELECT user_id, xu_added, status
  INTO v_user_id, v_xu, v_status
  FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  -- Chống double-processing
  IF v_status != 'pending' THEN RETURN FALSE; END IF;

  UPDATE transactions SET
    status = 'success',
    payment_ref = p_payment_ref,
    payment_raw = p_payment_raw,
    updated_at = now()
  WHERE id = p_transaction_id;

  UPDATE profiles SET
    xu = xu + v_xu,
    updated_at = now()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
