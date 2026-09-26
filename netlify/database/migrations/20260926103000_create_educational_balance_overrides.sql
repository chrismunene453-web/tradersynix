CREATE TABLE educational_balance_overrides (
    account_id TEXT PRIMARY KEY,
    balance NUMERIC(20, 8) NOT NULL CHECK (balance >= 0),
    currency TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('real', 'demo')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

