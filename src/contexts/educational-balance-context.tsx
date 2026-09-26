import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApiBase } from '@/hooks/useApiBase';

export type EducationalBalanceOverride = {
    accountId: string;
    balance: number;
    currency: string;
    accountType: 'real' | 'demo';
    updatedAt?: string;
};

type EducationalBalanceContextValue = {
    overrides: Record<string, EducationalBalanceOverride>;
    refresh: () => Promise<void>;
};

const EducationalBalanceContext = createContext<EducationalBalanceContextValue>({
    overrides: {},
    refresh: async () => undefined,
});

export const EducationalBalanceProvider = ({ children }: { children: React.ReactNode }) => {
    const { accountList } = useApiBase();
    const [overrides, setOverrides] = useState<Record<string, EducationalBalanceOverride>>({});

    const refresh = useCallback(async () => {
        const ids = (accountList ?? []).map(account => account.loginid).filter(Boolean);
        if (!ids.length) {
            setOverrides({});
            return;
        }

        try {
            const query = new URLSearchParams();
            ids.forEach(id => query.append('id', id));
            const response = await fetch(`/api/educational-balances?${query}`, { cache: 'no-store' });
            if (!response.ok) return;
            const payload = (await response.json()) as { overrides?: EducationalBalanceOverride[] };
            setOverrides(
                Object.fromEntries((payload.overrides ?? []).map(override => [override.accountId, override]))
            );
        } catch {
            // The trading experience remains usable when the optional educational API is unavailable.
        }
    }, [accountList]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const value = useMemo(() => ({ overrides, refresh }), [overrides, refresh]);
    return <EducationalBalanceContext.Provider value={value}>{children}</EducationalBalanceContext.Provider>;
};

export const useEducationalBalances = () => useContext(EducationalBalanceContext);

