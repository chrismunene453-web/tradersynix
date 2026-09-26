import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEducationalBalances } from '@/contexts/educational-balance-context';
import { useApiBase } from '@/hooks/useApiBase';
import { isDemoAccount } from '@/utils/account-helpers';

type AdminBalancePanelProps = {
    onClose: () => void;
};

const endpoint = '/api/educational-balances';

const AdminBalancePanel = ({ onClose }: AdminBalancePanelProps) => {
    const { accountList } = useApiBase();
    const { overrides, refresh } = useEducationalBalances();
    const [password, setPassword] = useState('5555');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [selectedId, setSelectedId] = useState(accountList?.[0]?.loginid ?? '');
    const [balance, setBalance] = useState('');
    const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const selectedAccount = useMemo(
        () => accountList?.find(account => account.loginid === selectedId),
        [accountList, selectedId]
    );
    const selectedOverride = overrides[selectedId];
    const accountType = selectedAccount && isDemoAccount(selectedAccount.loginid) ? 'demo' : 'real';

    useEffect(() => {
        const value = selectedOverride?.balance ?? selectedAccount?.balance ?? 0;
        setBalance(String(value));
        setStatus('idle');
        setMessage('');
    }, [selectedAccount, selectedOverride]);

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    const request = (method: 'POST' | 'DELETE', body?: Record<string, unknown>, accountId?: string) =>
        fetch(accountId ? `${endpoint}?id=${encodeURIComponent(accountId)}` : endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': password,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

    const unlock = async (event: FormEvent) => {
        event.preventDefault();
        if (!password) return;
        setStatus('working');
        try {
            const response = await request('POST', { action: 'authenticate' });
            if (!response.ok) throw new Error('That password did not unlock the panel.');
            setIsUnlocked(true);
            setStatus('idle');
            setMessage('');
        } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Unable to unlock the panel.');
        }
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        const numericBalance = Number(balance);
        if (!selectedAccount || !Number.isFinite(numericBalance) || numericBalance < 0) {
            setStatus('error');
            setMessage('Enter a valid non-negative balance.');
            return;
        }

        setStatus('working');
        try {
            const response = await request('POST', {
                accountId: selectedAccount.loginid,
                balance: numericBalance,
                currency: selectedAccount.currency || 'USD',
                accountType,
            });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(payload.error || 'Unable to save the balance.');
            await refresh();
            setStatus('success');
            setMessage('Educational balance saved.');
        } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Unable to save the balance.');
        }
    };

    const reset = async () => {
        if (!selectedAccount || !selectedOverride) return;
        setStatus('working');
        try {
            const response = await request('DELETE', undefined, selectedAccount.loginid);
            if (!response.ok) throw new Error('Unable to restore the live balance.');
            await refresh();
            setStatus('success');
            setMessage('Live balance display restored.');
        } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Unable to restore the live balance.');
        }
    };

    return createPortal(
        <div className='education-admin' role='presentation' onMouseDown={event => event.target === event.currentTarget && onClose()}>
            <section className='education-admin__panel' role='dialog' aria-modal='true' aria-labelledby='education-admin-title'>
                <button className='education-admin__close' type='button' onClick={onClose} aria-label='Close admin panel'>
                    ×
                </button>
                <div className='education-admin__eyebrow'>Private training controls</div>
                <h2 id='education-admin-title'>Balance laboratory</h2>
                <p className='education-admin__lede'>Set a simulated balance for accounts visible in this browser session.</p>

                {!isUnlocked ? (
                    <form className='education-admin__form education-admin__unlock' onSubmit={unlock}>
                        <label htmlFor='education-admin-password'>Admin password</label>
                        <input
                            id='education-admin-password'
                            type='password'
                            autoFocus
                            autoComplete='current-password'
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            placeholder='Enter private password'
                        />
                        <button type='submit' disabled={!password || status === 'working'}>
                            {status === 'working' ? 'Checking…' : 'Unlock panel'}
                        </button>
                    </form>
                ) : accountList?.length ? (
                    <form className='education-admin__form' onSubmit={save}>
                        <label htmlFor='education-admin-account'>Account</label>
                        <select id='education-admin-account' value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                            {accountList.map(account => (
                                <option key={account.loginid} value={account.loginid}>
                                    {isDemoAccount(account.loginid) ? 'Demo' : 'Real'} · {account.loginid} · {account.currency}
                                </option>
                            ))}
                        </select>

                        <label htmlFor='education-admin-balance'>Educational balance</label>
                        <div className='education-admin__amount'>
                            <input
                                id='education-admin-balance'
                                type='number'
                                min='0'
                                max='999999999999'
                                step='0.01'
                                value={balance}
                                onChange={event => setBalance(event.target.value)}
                            />
                            <span>{selectedAccount?.currency || 'USD'}</span>
                        </div>

                        <div className='education-admin__actions'>
                            <button type='submit' disabled={status === 'working'}>
                                {status === 'working' ? 'Saving…' : 'Apply balance'}
                            </button>
                            <button type='button' className='education-admin__secondary' disabled={!selectedOverride || status === 'working'} onClick={reset}>
                                Restore live
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className='education-admin__empty'>Log in to a trading account before editing its educational balance.</div>
                )}

                {message && <p className={`education-admin__message education-admin__message--${status}`}>{message}</p>}
                <div className='education-admin__warning'>
                    <strong>Simulation only.</strong> This changes the displayed balance in this project. It does not add funds, change Deriv records, or alter trade settlement.
                </div>
            </section>
        </div>,
        document.body
    );
};

export default AdminBalancePanel;

