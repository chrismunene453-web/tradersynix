import { useMemo, useRef } from 'react';
import clsx from 'clsx';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { localize } from '@deriv-com/translations';
import { Tooltip } from '@deriv-com/ui';

const statusConfigs = () => ({
    blinking: {
        className: 'app-footer__network-status-online app-footer__network-status-blinking',
        tooltip: localize('Connecting to server'),
    },
    offline: { className: 'app-footer__network-status-offline', tooltip: 'Offline' },
    online: { className: 'app-footer__network-status-online', tooltip: 'Online' },
});

const NetworkStatus = ({ onAdminRequest }: { onAdminRequest: () => void }) => {
    const status = useNetworkStatus();
    const { className, tooltip } = useMemo(() => statusConfigs()[status], [status]);
    const tapCount = useRef(0);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTap = () => {
        tapCount.current += 1;
        if (resetTimer.current) clearTimeout(resetTimer.current);

        if (tapCount.current >= 8) {
            tapCount.current = 0;
            onAdminRequest();
            return;
        }

        resetTimer.current = setTimeout(() => {
            tapCount.current = 0;
        }, 4000);
    };

    return (
        <Tooltip
            as='div'
            className='app-footer__icon'
            data-testid='dt_network_status'
            tooltipContent={localize('Network status: {{status}}', { status: tooltip })}
            onClick={handleTap}
        >
            <div className={clsx('app-footer__network-status', className)} data-testid='dt_circle' />
        </Tooltip>
    );
};

export default NetworkStatus;
