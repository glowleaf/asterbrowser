const { contextBridge, ipcRenderer } = require('electron');
// const { generatePrivateKey, getPublicKey, signEvent, nip19 } = require('nostr-tools'); // Disabled: For NWC
// const { connectWallet } = require('nostr-tools/nip47'); // Disabled: For NWC
// const axios = require('axios'); // Disabled: For LNBits API calls

/* --- LNBits/NWC Configuration (Disabled) ---
// --- Constants (Should be configurable or retrieved securely) ---
// These are placeholders and MUST be replaced by the user in Step 12
const LNBITS_URL = 'http://localhost:5000'; // Default LNBits URL
const LNBITS_ADMIN_API_KEY = 'YOUR_LNBITS_ADMIN_API_KEY'; // Placeholder
const NWC_CONNECTION_STRING = 'YOUR_NWC_CONNECTION_STRING'; // Placeholder
*/

// Service name for storing credentials securely
// const KEYTAR_SERVICE = 'aster-browser';

// --- Nostr Functionality ---
contextBridge.exposeInMainWorld('nostr', {
  // --- Key Management ---
  checkStatus: () => ipcRenderer.invoke('nostr-check-status'),
  login: (nsec) => ipcRenderer.invoke('nostr-login', nsec),
  createAccount: () => ipcRenderer.invoke('nostr-create'),
  logout: () => ipcRenderer.invoke('nostr-logout'),
  // NOTE: Logout/forget key functionality not implemented yet

  // --- Core Nostr Actions (for websites in webview) ---
  getPublicKey: () => ipcRenderer.invoke('nostr-get-public-key'),
  signEvent: (eventTemplate) => ipcRenderer.invoke('nostr-sign-event', eventTemplate),
  getRelays: () => ipcRenderer.invoke('nostr-get-relays'),
  nip04: {
      encrypt: (pubkey, plaintext) => ipcRenderer.invoke('nostr-nip04-encrypt', pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => ipcRenderer.invoke('nostr-nip04-decrypt', pubkey, ciphertext),
  },
  // TODO: Implement other NIP-07 functions like getRelays, nip04.encrypt/decrypt if needed
});

// --- NWC Functionality ---
contextBridge.exposeInMainWorld('nwc', {
    getConnections: () => ipcRenderer.invoke('nwc-get-connections'),
    connect: (nwcUri) => ipcRenderer.invoke('nwc-connect', nwcUri),
    setActive: (pubkey) => ipcRenderer.invoke('nwc-set-active', pubkey),
    getActive: () => ipcRenderer.invoke('nwc-get-active'),
    payInvoice: (bolt11) => ipcRenderer.invoke('nwc-pay-invoice', bolt11),
    disconnect: (pubkey) => ipcRenderer.invoke('nwc-disconnect', pubkey),
});

// --- Ad Management Functionality ---
contextBridge.exposeInMainWorld('ads', {
  toggleAds: (enabled) => ipcRenderer.send('toggle-ads', enabled),
  onAdStatus: (callback) => ipcRenderer.on('ad-status', (_event, enabled) => callback(enabled)),
  requestAd: () => ipcRenderer.send('request-ad'),
  onDisplayAd: (callback) => ipcRenderer.on('display-ad', (_event, ad) => callback(ad)),
});

/* --- LNBits/Wallet Functionality (Disabled) ---
// --- LNBits and Wallet Functionality ---
contextBridge.exposeInMainWorld('wallet', {
  // Creates a new LNBits wallet (e.g., for a new Nostr user)
  createLnbitsWallet: async (walletName) => {
    if (!LNBITS_ADMIN_API_KEY || LNBITS_ADMIN_API_KEY === 'YOUR_LNBITS_ADMIN_API_KEY') {
      console.error('LNBits Admin API Key not configured in preload.js');
      throw new Error('LNBits Admin API Key not configured.');
    }
    try {
      console.log(`Attempting to create LNBits wallet: ${walletName}`);
      const response = await axios.post(
        `${LNBITS_URL}/api/v1/wallet`,
        { name: walletName },
        { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } }
      );
      console.log('LNBits wallet creation response:', response.data);
      // TODO: Securely store the user's wallet API key (response.data.adminkey)
      // Maybe associate it with the npub using keytar?
      return response.data; // Contains wallet ID, admin key, invoice key etc.
    } catch (error) {
      console.error('Error creating LNBits wallet:', error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Processes ad payment: Pays user and Aster share from advertiser wallet
  processAdPayment: async (ad, userWalletId, asterWalletId) => {
    if (!LNBITS_ADMIN_API_KEY || LNBITS_ADMIN_API_KEY === 'YOUR_LNBITS_ADMIN_API_KEY') {
      console.error('LNBits Admin API Key not configured in preload.js');
      throw new Error('LNBits Admin API Key not configured.');
    }
    if (!ad || !ad.sats || !ad.advertiserWalletId || !userWalletId || !asterWalletId) {
        console.error('Missing data for ad payment processing');
        throw new Error('Invalid ad payment data');
    }

    const userAmount = Math.floor(ad.sats * 0.7);
    const asterAmount = ad.sats - userAmount; // Ensure total amount is covered

    try {
        // Step 1: Create invoice for the user
        console.log(`Creating invoice for user (${userWalletId}) for ${userAmount} sats`);
        const userInvoiceRes = await axios.post(
            `${LNBITS_URL}/api/v1/payments`,
            { out: false, amount: userAmount, memo: `Ad reward ${ad.id}` },
            { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } } // TODO: Use userWallet read key?
            // Using Admin key here for simplicity, ideally use specific wallet keys
        );
        const userInvoice = userInvoiceRes.data.payment_request;
        console.log(`User invoice created: ${userInvoice}`);

        // Step 2: Pay user invoice from advertiser wallet
        console.log(`Paying user invoice from advertiser wallet (${ad.advertiserWalletId})`);
        await axios.post(
            `${LNBITS_URL}/api/v1/payments`,
            { out: true, bolt11: userInvoice },
            { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } } // TODO: Use advertiserWallet admin key?
        );
        console.log(`User invoice paid.`);

        // Step 3: Create invoice for Aster
        console.log(`Creating invoice for Aster (${asterWalletId}) for ${asterAmount} sats`);
        const asterInvoiceRes = await axios.post(
            `${LNBITS_URL}/api/v1/payments`,
            { out: false, amount: asterAmount, memo: `Ad revenue ${ad.id}` },
            { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } } // TODO: Use asterWallet read key?
        );
        const asterInvoice = asterInvoiceRes.data.payment_request;
        console.log(`Aster invoice created: ${asterInvoice}`);

        // Step 4: Pay Aster invoice from advertiser wallet
        console.log(`Paying Aster invoice from advertiser wallet (${ad.advertiserWalletId})`);
        await axios.post(
            `${LNBITS_URL}/api/v1/payments`,
            { out: true, bolt11: asterInvoice },
            { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } } // TODO: Use advertiserWallet admin key?
        );
        console.log(`Aster invoice paid.`);

        return { userAmountPaid: userAmount };
    } catch (error) {
        console.error('Error processing ad payment:', error.response ? error.response.data : error.message);
        throw error;
    }
  },

  // Creates an invoice for tipping using the user's LNBits wallet
  createLnbitsTipInvoice: async (amount, memo, userWalletId) => {
    if (!LNBITS_ADMIN_API_KEY || LNBITS_ADMIN_API_KEY === 'YOUR_LNBITS_ADMIN_API_KEY') { // TODO: Use userWallet invoice key?
        console.error('LNBits API Key not configured in preload.js');
        throw new Error('LNBits API Key not configured.');
      }
    try {
      console.log(`Creating LNBits tip invoice for ${amount} sats`);
      const response = await axios.post(
        `${LNBITS_URL}/api/v1/payments`,
        { out: false, amount: amount, memo: memo || 'Tip via Aster Browser' },
        { headers: { 'X-Api-Key': LNBITS_ADMIN_API_KEY, 'Content-type': 'application/json' } } // TODO: Use userWallet invoice key
      );
      console.log('LNBits tip invoice created:', response.data.payment_request);
      return response.data.payment_request;
    } catch (error) {
      console.error('Error creating LNBits tip invoice:', error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Sends a tip using Nostr Wallet Connect (NWC)
  sendNwcTip: async (amount, description) => {
    if (!NWC_CONNECTION_STRING || NWC_CONNECTION_STRING === 'YOUR_NWC_CONNECTION_STRING') {
        console.error('NWC Connection String not configured in preload.js');
        throw new Error('NWC Connection String not configured.');
    }
    try {
        console.log(`Attempting NWC payment for ${amount} sats`);
        const wallet = await connectWallet(NWC_CONNECTION_STRING);
        // NWC amounts are in millisatoshis
        const invoice = await wallet.makeInvoice({
            amount: amount * 1000, // Convert sats to millisats
            description: description || 'Tip via Aster Browser (NWC)',
        });
        console.log('NWC invoice created:', invoice);
        // Assuming the user wants to pay an invoice they just created for the tip recipient
        // If the goal is just to *send* from NWC, we might need a different NWC flow (e.g., pay specific invoice)
        // For now, let's assume makeInvoice/payInvoice is for testing the connection
        // const payment = await wallet.payInvoice(invoice); // This would pay the invoice just created
        // console.log('NWC payment result:', payment);
        // return payment;
        // Returning the invoice for demonstration purposes, as paying it immediately might not be the intended flow
        alert('NWC Connected. Created invoice (check console). Paying invoice from NWC needs recipient invoice.');
        return { invoice };
    } catch (error) {
        console.error('Error sending NWC tip:', error);
        throw error;
    }
  },
});
--- End LNBits/Wallet Functionality (Disabled) --- */


// --- Misc ---
// Expose minimal Node.js APIs if absolutely necessary (use with caution)
// contextBridge.exposeInMainWorld('nodeApi', {
//   path: path, // Example: Exposing path module
// });

console.log('Preload script updated for new Nostr IPC handling.'); 