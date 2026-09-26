import useActiveAccount from '@/hooks/api/account/useActiveAccount';

export type TAccountSwitcher = {
    activeAccount:
        | (Omit<NonNullable<ReturnType<typeof useActiveAccount>['data']>, 'isEducational'> & {
              isEducational?: boolean;
          })
        | undefined;
};
