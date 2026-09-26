import { createHash, timingSafeEqual } from 'node:crypto';
import type { Config } from '@netlify/functions';
import { getDatabase } from '@netlify/database';

type OverrideRow = {
    account_id: string;
    balance: string;
    currency: string;
    account_type: 'real' | 'demo';
    updated_at: string;
};

const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const isAccountId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{2,40}$/.test(value);

const isAuthorized = (request: Request) => {
    const configuredHash = Netlify.env.get('ADMIN_PANEL_PASSWORD_SHA256')?.trim().toLowerCase();
    const password = request.headers.get('x-admin-password') ?? '';
    if (!configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash) || !password) return false;

    const submittedHash = createHash('sha256').update(password, 'utf8').digest('hex');
    return timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(configuredHash, 'hex'));
};

export default async (request: Request) => {
    const db = getDatabase();

    if (request.method === 'GET') {
        const ids = new URL(request.url).searchParams.getAll('id').filter(isAccountId).slice(0, 25);
        if (!ids.length) return json({ overrides: [] });

        const rows = (
            await Promise.all(
                ids.map(id =>
                    db.sql<OverrideRow>`
                        SELECT account_id, balance, currency, account_type, updated_at
                        FROM educational_balance_overrides
                        WHERE account_id = ${id}
                    `
                )
            )
        ).flat();

        return json({
            overrides: rows.map(row => ({
                accountId: row.account_id,
                balance: Number(row.balance),
                currency: row.currency,
                accountType: row.account_type,
                updatedAt: row.updated_at,
            })),
        });
    }

    if (!isAuthorized(request)) {
        return json({ error: 'Incorrect password or admin password is not configured.' }, 401);
    }

    if (request.method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (body?.action === 'authenticate') return json({ authenticated: true });

        const accountId = body?.accountId;
        const balance = Number(body?.balance);
        const currency = typeof body?.currency === 'string' ? body.currency.trim().toUpperCase() : '';
        const accountType = body?.accountType;

        if (
            !isAccountId(accountId) ||
            !Number.isFinite(balance) ||
            balance < 0 ||
            balance > 999_999_999_999 ||
            !/^[A-Z0-9]{2,12}$/.test(currency) ||
            (accountType !== 'real' && accountType !== 'demo')
        ) {
            return json({ error: 'Enter a valid account, currency, and non-negative balance.' }, 400);
        }

        const [row] = await db.sql<OverrideRow>`
            INSERT INTO educational_balance_overrides (account_id, balance, currency, account_type, updated_at)
            VALUES (${accountId}, ${balance}, ${currency}, ${accountType}, NOW())
            ON CONFLICT (account_id) DO UPDATE SET
                balance = EXCLUDED.balance,
                currency = EXCLUDED.currency,
                account_type = EXCLUDED.account_type,
                updated_at = NOW()
            RETURNING account_id, balance, currency, account_type, updated_at
        `;

        return json({
            override: {
                accountId: row.account_id,
                balance: Number(row.balance),
                currency: row.currency,
                accountType: row.account_type,
                updatedAt: row.updated_at,
            },
        });
    }

    if (request.method === 'DELETE') {
        const accountId = new URL(request.url).searchParams.get('id');
        if (!isAccountId(accountId)) return json({ error: 'Invalid account.' }, 400);

        await db.sql`DELETE FROM educational_balance_overrides WHERE account_id = ${accountId}`;
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    return json({ error: 'Method not allowed.' }, 405);
};

export const config: Config = {
    path: '/api/educational-balances',
};
