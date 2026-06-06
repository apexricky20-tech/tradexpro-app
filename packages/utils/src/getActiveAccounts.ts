import { runInAction } from 'mobx';
import Cookies from 'js-cookie';
import { requestSessionActive } from '@deriv-com/auth-client';

import Chat from './chat';
import isTmbEnabled from './isTmbEnabled';

// Expanded type declaration to safely intercept tight-validation properties
declare const ClientStore: { 
    setIsClientStoreInitialized: (v: boolean) => void;
    prevent_single_login?: boolean;
    is_client_store_initialized?: boolean;
} | undefined;

type TMBApiReturnedValue = {
    tokens?: {
        loginid: string;
        token: string;
        cur: string;
    };
    active?: boolean;
};

const domains = ['deriv.com', 'deriv.dev', 'binary.sx', 'pages.dev', 'localhost', 'deriv.be', 'deriv.me'];
function endChat() {
    window.LC_API?.close_chat?.();
    window.LiveChatWidget?.call('hide');
    window.fcWidget?.close();
    Chat.clear();
}
const currentDomain = window.location.hostname.split('.').slice(-2).join('.');

const handleLogout = async () => {
    localStorage.removeItem('closed_toast_notifications');
    localStorage.removeItem('is_wallet_migration_modal_closed');
    localStorage.removeItem('active_wallet_loginid');
    localStorage.removeItem('config.account1');
    localStorage.removeItem('config.tokens');
    localStorage.removeItem('verification_code.system_email_change');
    localStorage.removeItem('verification_code.request_email');
    localStorage.removeItem('new_email.system_email_change');
    localStorage.removeItem('active_loginid');
    localStorage.removeItem('clientAccounts');
    Object.keys(sessionStorage)
        .filter(key => key !== 'trade_store')
        .forEach(key => sessionStorage.removeItem(key));
    endChat();
    if (domains.includes(currentDomain)) {
        Cookies.set('logged_state', 'false', {
            domain: currentDomain,
            expires: 30,
            path: '/',
            secure: true,
            });
    }
};

const setAccountInSessionStorage = (loginid?: string, isWallet = false) => {
    if (!loginid) return;
    const key = isWallet ? 'active_wallet_loginid' : 'active_loginid';
    sessionStorage.setItem(key, loginid);
};

const getActiveSessions = async () => {
    try {
        const data = await requestSessionActive();
        return data;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to get active sessions', error);
        return undefined;
    }
};

const getActiveAccounts = async () => {
    try {
        const is_tmb_enabled = await isTmbEnabled();

        if (!is_tmb_enabled) {
            return undefined;
        }

        const activeSessions = await getActiveSessions();

        if (!activeSessions?.active) {
            // If logging out trips strict modifications, wrap it in a micro action run
            if (typeof ClientStore !== 'undefined' && ClientStore) {
                await runInAction(async () => {
                    await handleLogout();
                });
            } else {
                await handleLogout();
            }
            return undefined;
        }

        if (activeSessions?.active) {
            const localStorageClientAccounts = localStorage.getItem('clientAccounts');
            const activeSessionTokens = JSON.stringify(activeSessions?.tokens);
            const shouldReinitializeClientStore = localStorageClientAccounts !== activeSessionTokens;

            if (shouldReinitializeClientStore) {
                localStorage.removeItem('client.accounts');
            }

            localStorage.setItem('clientAccounts', activeSessionTokens);

            const params = new URLSearchParams(location.search);
            let account = params.get('account');
            const loginID =
                params.get('loginid') ||
                sessionStorage.getItem('active_wallet_loginid') ||
                sessionStorage.getItem('active_loginid');

            if (!account && !loginID && activeSessions?.tokens?.length > 0) {
                const firstAccount = activeSessions.tokens[0];
                account = firstAccount.loginid.startsWith('VR') ? 'demo' : firstAccount.cur;
                params.set('account', account ?? '');
                const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
                window.history.replaceState({}, '', newUrl);
            } else if (!account && loginID && activeSessions?.tokens?.length > 0) {
                const matchingToken = activeSessions.tokens.find(token => token.loginid === loginID);

                if (matchingToken) {
                    account = matchingToken.loginid.startsWith('VR') ? 'demo' : matchingToken.cur;
                    params.set('account', account ?? '');
                    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
                    window.history.replaceState({}, '', newUrl);
                } else {
                    const firstAccount = activeSessions.tokens[0];
                    account = firstAccount.loginid.startsWith('VR') ? 'demo' : firstAccount.cur;
                    params.set('account', account ?? '');
                    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
                    window.history.replaceState({}, '', newUrl);
                }
            }

            if (account?.toLocaleUpperCase() === 'DEMO') {
                const demoAccount = activeSessions?.tokens?.find(
                    item => item?.cur?.toLocaleUpperCase() === 'USD' && item.loginid.startsWith('VRTC')
                );
                const demoWalletAccount = activeSessions?.tokens?.find(
                    item => item?.cur?.toLocaleUpperCase() === 'USD' && item.loginid.startsWith('VRW')
                );

                if (!demoAccount && (sessionStorage.getItem('active_loginid') || localStorage.getItem('active_loginid'))) {
                    sessionStorage.removeItem('active_loginid');
                    localStorage.removeItem('active_loginid');
                }

                if (
                    !demoWalletAccount &&
                    (sessionStorage.getItem('active_wallet_loginid') || localStorage.getItem('active_wallet_loginid'))
                ) {
                    sessionStorage.removeItem('active_wallet_loginid');
                    localStorage.removeItem('active_wallet_loginid');
                }

                setAccountInSessionStorage(demoAccount?.loginid);
                setAccountInSessionStorage(demoWalletAccount?.loginid, true);
            } else {
                const realAccount = activeSessions?.tokens?.find(
                    item =>
                        item?.cur?.toLocaleUpperCase() === account?.toLocaleUpperCase() &&
                        ((item?.loginid.startsWith('CR') && !item?.loginid.startsWith('CRW')) ||
                            (item?.loginid.startsWith('MF') && !item.loginid.startsWith('MFW')))
                );

                const realWalletAccount = activeSessions?.tokens?.find(
                    item =>
                        item?.cur?.toLocaleUpperCase() === account?.toLocaleUpperCase() &&
                        (item?.loginid.startsWith('CRW') || item?.loginid.startsWith('MFW'))
                );

                const storedLoginid = sessionStorage.getItem('active_loginid') || localStorage.getItem('active_loginid');
                const storedWalletLoginid =
                    sessionStorage.getItem('active_wallet_loginid') || localStorage.getItem('active_wallet_loginid');

                const storedLoginidExists =
                    storedLoginid && activeSessions?.tokens?.some(token => token.loginid === storedLoginid);
                const storedWalletLoginidExists =
                    storedWalletLoginid && activeSessions?.tokens?.some(token => token.loginid === storedWalletLoginid);

                if (!realAccount && storedLoginid && !storedLoginidExists) {
                    sessionStorage.removeItem('active_loginid');
                    localStorage.removeItem('active_loginid');
                }

                if (!realWalletAccount && storedWalletLoginid && !storedWalletLoginidExists) {
                    sessionStorage.removeItem('active_wallet_loginid');
                    localStorage.removeItem('active_wallet_loginid');
                }

                const accountToUse = realAccount ?? activeSessions?.tokens?.find(token => token.loginid === storedLoginid);
                const walletAccountToUse =
                    realWalletAccount ?? activeSessions?.tokens?.find(token => token.loginid === storedWalletLoginid);

                setAccountInSessionStorage(accountToUse?.loginid);
                setAccountInSessionStorage(walletAccountToUse?.loginid, true);
            }

            const convertedResult = {};
            activeSessions.tokens.forEach((account: TMBApiReturnedValue['tokens'], index: number) => {
                const num = index + 1;
                account?.loginid && ((convertedResult as Record<string, string>)[`acct${num}`] = account.loginid);
                account?.token && ((convertedResult as Record<string, string>)[`token${num}`] = account.token);
                account?.cur && ((convertedResult as Record<string, string>)[`cur${num}`] = account.cur);
            });

            return shouldReinitializeClientStore ? convertedResult : undefined;
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Critical workflow exception inside getActiveAccounts:', error);
        return undefined;
    }
};

export default getActiveAccounts;

export async function initApp() {
    try {
        await getActiveAccounts();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Session initialization failed, falling back to logged-out state:", error);
    } finally {
        if (typeof ClientStore !== 'undefined' && ClientStore) {
            try {
                // Safeguard initialization variables by running them inside a dedicated MobX action
                runInAction(() => {
                    ClientStore.setIsClientStoreInitialized(true);
                    if ('prevent_single_login' in ClientStore) {
                        ClientStore.prevent_single_login = true;
                    }
                });
            } catch (mobxError) {
                try {
                    runInAction(() => {
                        (ClientStore as any).is_client_store_initialized = true;
                        (ClientStore as any).prevent_single_login = true;
                    });
                } catch (fallbackError) {
                    // eslint-disable-next-line no-console
                    console.error("Failed to unblock MobX store initialization flags:", fallbackError);
                }
            }
        }
    }
}