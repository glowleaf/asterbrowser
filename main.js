const { app, BrowserWindow, session, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
// const { Adblocker } = require('@brave/adblock-rs'); // Disabled: Dependency install failed
const fs = require('fs');
const nostrTools = require('nostr-tools'); // Added nostr-tools
const Store = require('electron-store'); // Added electron-store

// Initialize electron-store
const store = new Store();

// --- NWC Storage Key ---
const NWC_CONNECTIONS_KEY = 'nwcConnections'; // Store connection details { name: string, uri: string, pubkey: string, relay: string, secret: string, budget?: number }
let activeNwcConnection = null; // Cache active connection details in memory for session

/* --- Nostr Key Storage ---
const NSEC_STORAGE_KEY = 'nostrEncryptedPrivateKey'; // Use a distinct key
let decryptedNsec = null; // Cache decrypted key in memory for session

function getStoredNsec() {
  if (decryptedNsec) return decryptedNsec;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedNsecBase64 = store.get(NSEC_STORAGE_KEY);
      if (encryptedNsecBase64) {
          const encryptedNsec = Buffer.from(encryptedNsecBase64, 'base64'); // Assuming stored as base64 string
          decryptedNsec = safeStorage.decryptString(encryptedNsec);
          console.log('Decrypted nsec from storage.');
          return decryptedNsec;
      } else {
          console.log('No nsec found in storage.');
      }
    } else {
      console.warn('Safe storage is not available. Cannot securely retrieve Nostr key.');
      // Fallback: Check if an insecurely stored key exists (for transition, maybe remove later)
      const insecureNsec = store.get('nostrInsecurePrivateKey');
      if (insecureNsec) {
          console.warn('Found insecurely stored nsec. Using it, but this is not recommended.');
          decryptedNsec = insecureNsec;
          return decryptedNsec;
      }
    }
  } catch (error) {
    console.error('Failed to get or decrypt nsec:', error);
    // Attempt to clear corrupted data if decryption failed
    store.delete(NSEC_STORAGE_KEY);
    console.error('Cleared potentially corrupted nsec data from storage.');
    return null;
  }
  return null;
}

async function storeNsec(nsec) {
    decryptedNsec = nsec; // Cache in memory
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encryptedNsec = safeStorage.encryptString(nsec);
            const encryptedNsecBase64 = encryptedNsec.toString('base64'); // Store as base64 string
            store.set(NSEC_STORAGE_KEY, encryptedNsecBase64); // Write encrypted buffer to storage
            console.log('Nsec encrypted and stored.');
            // Remove any insecure key if present during transition
            store.delete('nostrInsecurePrivateKey');
            return true;
        } else {
            console.warn('Safe storage not available. Storing nsec insecurely (NOT RECOMMENDED).');
            // Fallback: Store insecurely
            store.set('nostrInsecurePrivateKey', nsec);
            // Clear any previously encrypted key
            store.delete(NSEC_STORAGE_KEY);
            return true; // Indicate success even if insecure for now
        }
    } catch (error) {
        console.error('Failed to store nsec:', error);
        decryptedNsec = null; // Clear cache on failure
        return false;
    }
}

async function deleteNsec() {
    decryptedNsec = null; // Clear memory cache
    try {
        store.delete(NSEC_STORAGE_KEY); // Delete encrypted key
        store.delete('nostrInsecurePrivateKey'); // Delete insecure key too
        console.log('Deleted stored nsec data.');
        return true;
    } catch (error) {
        console.error('Failed to delete stored nsec:', error);
        return false;
    }
}

// --- End Nostr Key Storage --- */


/* --- External Process Spawning (Disabled) ---
// --- Platform Specific Paths ---
// NOTE: Paths for config files might need adjustment on Windows.
// e.g., %APPDATA%\Bitcoin or %LOCALAPPDATA%\Bitcoin instead of ~/.bitcoin
// e.g., %LOCALAPPDATA%\Lnd instead of ~/.lnd
const bitcoinConfPath = path.join(process.env.HOME, '.bitcoin', 'bitcoin.conf'); // Adjust for Windows
const lndConfPath = path.join(process.env.HOME, '.lnd', 'lnd.conf'); // Adjust for Windows
const nostrRelayExePath = path.join(__dirname, 'nostr-relay', 'target', 'release', 'nostr-relay'); // Adjust for Windows (.exe extension?)

// --- Spawn External Processes ---
// NOTE: Ensure 'bitcoind', 'lnd', 'python3' (or 'python'), and the nostr-relay executable
// are in the system PATH or provide absolute paths. Command flags might differ on Windows.

// Start Bitcoin Core (pruned, Mainnet)
console.log(`Attempting to start bitcoind with conf: ${bitcoinConfPath}`);
const bitcoindProcess = spawn('bitcoind', [`-conf=${bitcoinConfPath}`], { // Use 'bitcoind.exe' on Windows?
  env: { ...process.env },
  shell: true // May help resolve PATH issues, but use with caution
});
bitcoindProcess.stdout.on('data', (data) => console.log(`Bitcoind: ${data}`));
bitcoindProcess.stderr.on('data', (data) => console.error(`Bitcoind Error: ${data}`));
bitcoindProcess.on('error', (err) => console.error('Failed to start bitcoind:', err));
bitcoindProcess.on('close', (code) => console.log(`bitcoind process exited with code ${code}`));


// Start LND
console.log(`Attempting to start lnd with conf: ${lndConfPath}`);
const lndProcess = spawn('lnd', [`--configfile=${lndConfPath}`], { // Use 'lnd.exe' on Windows?
  env: { ...process.env },
  shell: true
});
lndProcess.stdout.on('data', (data) => console.log(`LND: ${data}`));
lndProcess.stderr.on('data', (data) => console.error(`LND Error: ${data}`));
lndProcess.on('error', (err) => console.error('Failed to start lnd:', err));
lndProcess.on('close', (code) => console.log(`lnd process exited with code ${code}`));


// Start LNBits
// NOTE: Ensure Python is installed and in PATH. Might be 'python' instead of 'python3' on Windows.
const lnbitsCwd = path.join(__dirname, 'lnbits');
console.log(`Attempting to start LNBits in: ${lnbitsCwd}`);
const lnbitsProcess = spawn('python3', ['-m', 'uvicorn', 'lnbits.main:app', '--port', '5000', '--host', '127.0.0.1'], {
  cwd: lnbitsCwd,
  env: { ...process.env, PYTHONUNBUFFERED: '1' },
  shell: true
});
lnbitsProcess.stdout.on('data', (data) => console.log(`LNBits: ${data}`));
lnbitsProcess.stderr.on('data', (data) => console.error(`LNBits Error: ${data}`));
lnbitsProcess.on('error', (err) => console.error('Failed to start LNBits:', err));
lnbitsProcess.on('close', (code) => console.log(`LNBits process exited with code ${code}`));


// Start Nostr relay
const nostrRelayCwd = path.join(__dirname, 'nostr-relay');
console.log(`Attempting to start Nostr relay: ${nostrRelayExePath} in ${nostrRelayCwd}`);
const nostrRelayProcess = spawn(nostrRelayExePath, [], { // Add .exe for Windows?
  cwd: nostrRelayCwd,
  shell: true
});
nostrRelayProcess.stdout.on('data', (data) => console.log(`Nostr Relay: ${data}`));
nostrRelayProcess.stderr.on('data', (data) => console.error(`Nostr Relay Error: ${data}`));
nostrRelayProcess.on('error', (err) => console.error('Failed to start Nostr relay:', err));
nostrRelayProcess.on('close', (code) => console.log(`Nostr relay process exited with code ${code}`));
--- End External Process Spawning (Disabled) --- */


// --- Ad Blocker Setup (Disabled) ---
// NOTE: User needs to download easylist.txt manually or using a Windows command.
// NOTE: Adblocking disabled because @brave/adblock-rs failed to install.
/*
const easylistPath = path.join(__dirname, 'easylist.txt');
let adblocker;
try {
  if (fs.existsSync(easylistPath)) {
      adblocker = new Adblocker();
      adblocker.loadFromFile(easylistPath);
      console.log('Adblocker loaded from:', easylistPath);
  } else {
      console.warn('easylist.txt not found. Adblocking will be disabled.');
      adblocker = { check: () => false }; // No-op adblocker
  }
} catch (error) {
    console.error('Failed to initialize adblocker:', error);
    adblocker = { check: () => false }; // No-op adblocker on error
}
*/
const adblocker = { check: () => false }; // No-op adblocker placeholder
// --- End Ad Blocker Setup (Disabled) ---

// --- Ad Catalog ---
const adsPath = path.join(__dirname, 'ads.json');
let ads = [];
try {
    if (fs.existsSync(adsPath)) {
        ads = JSON.parse(fs.readFileSync(adsPath, 'utf-8'));
        console.log('Ad catalog loaded from:', adsPath);
    } else {
        console.warn('ads.json not found. No ads will be served.');
    }
} catch (error) {
    console.error('Failed to load ad catalog:', error);
}


// --- Ad Settings ---
let adEnabled = false;

// --- Electron Window Creation ---
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // Important for security
      contextIsolation: true, // Important for security
      webviewTag: true, // Enable webview support
      preload: path.join(__dirname, 'preload.js'), // Securely expose APIs
    },
  });

  win.loadFile('index.html');

  // Apply ad-blocking using defaultSession (Disabled)
  /*
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    // Ensure adblocker is initialized before using check
    const shouldBlock = adblocker && adblocker.check(details.url);
    if (shouldBlock) {
        // console.log('Blocking:', details.url);
    }
    callback({ cancel: shouldBlock });
  });
  */
  console.log('Ad blocking is currently disabled.');

  // Handle ad toggle from renderer
  ipcMain.on('toggle-ads', (event, enabled) => {
    adEnabled = enabled;
    console.log('Ad status toggled:', adEnabled);
    event.reply('ad-status', adEnabled); // Acknowledge status change
  });

  // Serve ads when requested by renderer
  ipcMain.on('request-ad', (event) => {
    if (adEnabled && ads.length > 0) {
      const ad = ads[Math.floor(Math.random() * ads.length)];
      console.log('Serving ad:', ad.id);
      event.reply('display-ad', ad); // Still send ad data, payment logic is in renderer
    } else if (adEnabled && ads.length === 0) {
        console.log('Ad request received, but ad catalog is empty or failed to load.');
    }
    // Do nothing if ads are disabled
  });

  // --- Nostr IPC Handlers ---

  ipcMain.handle('nostr-check-status', async (event) => {
    const nsec = getStoredNsec();
    if (nsec) {
      try {
        const pk = nostrTools.getPublicKey(nsec);
        const npub = nostrTools.nip19.npubEncode(pk);
        return { loggedIn: true, npub };
      } catch (error) {
        console.error('Error deriving npub from stored nsec:', error);
        return { loggedIn: false, error: 'Invalid stored key' };
      }
    }
    return { loggedIn: false };
  });

  ipcMain.handle('nostr-login', async (event, nsecInput) => {
    try {
      // Validate the provided nsec
      const pk = nostrTools.getPublicKey(nsecInput); // Throws error if invalid
      const stored = await storeNsec(nsecInput);
      if (stored) {
        const npub = nostrTools.nip19.npubEncode(pk);
        console.log('Nostr login successful for npub:', npub);
        return { success: true, npub };
      } else {
          return { success: false, error: 'Failed to store key' };
      }
    } catch (error) {
      console.error('Nostr login failed:', error);
      return { success: false, error: 'Invalid nsec key provided' };
    }
  });

  ipcMain.handle('nostr-create', async (event) => {
    try {
      const sk = nostrTools.generatePrivateKey();
      const nsec = nostrTools.nip19.nsecEncode(sk);
      const pk = nostrTools.getPublicKey(sk);
      const npub = nostrTools.nip19.npubEncode(pk);

      const stored = await storeNsec(nsec); // Store the new nsec
        if (stored) {
            console.log('New Nostr key generated and stored. NPub:', npub);
            // IMPORTANT: The nsec is returned here for the user to back up.
            // Consider if this is the best UX/security approach.
            // Maybe show it once in the UI with strong warnings?
            return { success: true, npub, nsec };
        } else {
            return { success: false, error: 'Failed to store newly generated key' };
        }
    } catch (error) {
      console.error('Failed to generate Nostr key:', error);
      return { success: false, error: 'Key generation failed' };
    }
  });

  ipcMain.handle('nostr-get-public-key', async (event) => {
    const nsec = getStoredNsec();
    if (!nsec) {
      return { error: 'Not logged in' };
    }
    try {
      const pk = nostrTools.getPublicKey(nsec);
      const npub = nostrTools.nip19.npubEncode(pk);
      return { npub };
    } catch (error) {
      console.error('Error getting public key:', error);
      return { error: 'Failed to derive public key' };
    }
  });

  ipcMain.handle('nostr-sign-event', async (event, eventTemplate) => {
     const nsec = getStoredNsec();
     if (!nsec) {
       return { error: 'Not logged in' };
     }
     try {
        // Ensure essentials are present if not provided
        eventTemplate.created_at = eventTemplate.created_at || Math.floor(Date.now() / 1000);
        eventTemplate.pubkey = eventTemplate.pubkey || nostrTools.getPublicKey(nsec);
        eventTemplate.id = eventTemplate.id || nostrTools.getEventHash(eventTemplate);

        // Sign the event
       const signedEvent = nostrTools.finishEvent(eventTemplate, nsec);
       console.log('Signed Nostr event:', signedEvent.id);
       return { signedEvent };
     } catch (error) {
       console.error('Failed to sign event:', error);
       return { error: `Event signing failed: ${error.message}` };
     }
  });

  // Logout Handler
  ipcMain.handle('nostr-logout', async (event) => {
    const deleted = await deleteNsec();
    return { success: deleted };
  });

  // Placeholder NIP-07 Handlers
  ipcMain.handle('nostr-get-relays', async (event) => {
      // TODO: Implement relay management (store user's preferred relays?)
      console.warn('nostr-get-relays not fully implemented. Returning empty object.');
      return { relays: {} }; // NIP-07 expects an object { [url]: {read, write} }
  });

  ipcMain.handle('nostr-nip04-encrypt', async (event, pubkey, plaintext) => {
      const nsec = getStoredNsec();
      if (!nsec) return { error: 'Not logged in' };
      try {
          // TODO: Validate pubkey and plaintext
          const ciphertext = nostrTools.nip04.encrypt(nsec, pubkey, plaintext);
          return { result: ciphertext };
      } catch (error) {
          console.error('NIP-04 encryption failed:', error);
          return { error: `Encryption failed: ${error.message}` };
      }
  });

  ipcMain.handle('nostr-nip04-decrypt', async (event, pubkey, ciphertext) => {
      const nsec = getStoredNsec();
      if (!nsec) return { error: 'Not logged in' };
      try {
          // TODO: Validate pubkey and ciphertext
          const plaintext = nostrTools.nip04.decrypt(nsec, pubkey, ciphertext);
          return { result: plaintext };
      } catch (error) {
          console.error('NIP-04 decryption failed:', error);
          // Decryption often fails with bad data/key, return specific error?
          return { error: `Decryption failed: ${error.message}` };
      }
  });

  // --- End Nostr IPC Handlers ---

  // --- NWC IPC Handlers ---
  ipcMain.handle('nwc-get-connections', async (event) => {
    const connections = store.get(NWC_CONNECTIONS_KEY, []);
    return connections.map(c => ({ name: c.name, pubkey: c.pubkey, relay: c.relay, budget: c.budget })); // Return safe info
  });

  ipcMain.handle('nwc-connect', async (event, nwcUri) => {
      if (!nwcUri || !nwcUri.startsWith('nostr+walletconnect:')) {
          return { success: false, error: 'Invalid NWC URI format.' };
      }
      try {
          const { pubkey, relay, secret, lud16 } = nostrTools.nip47.parseWalletConnectUrl(nwcUri);
          if (!pubkey || !relay || !secret) {
              throw new Error('Failed to parse essential details from NWC URI.');
          }

          // TODO: Maybe connect to relay and fetch NIP-47 info event to verify and get budget/permissions?
          // This requires async relay pool connection.

          const connections = store.get(NWC_CONNECTIONS_KEY, []);
          const name = lud16 || `Wallet (${pubkey.substring(0, 6)}...)`; // Use lud16 or derived name

          // Check if connection already exists (by pubkey)
          const existingIndex = connections.findIndex(c => c.pubkey === pubkey);
          const connectionData = {
              name: name,
              uri: nwcUri, // Store original URI for reference?
              pubkey: pubkey,
              relay: relay,
              secret: safeStorage.encryptString(secret).toString('base64'), // Encrypt and store secret
              lud16: lud16,
              // budget: fetchedBudget // Store budget if fetched
          };

          if (existingIndex > -1) {
              connections[existingIndex] = connectionData; // Update existing
              console.log('Updated existing NWC connection:', name);
          } else {
              connections.push(connectionData);
              console.log('Added new NWC connection:', name);
          }

          store.set(NWC_CONNECTIONS_KEY, connections);
          activeNwcConnection = connectionData; // Set as active for the session (decrypt secret needed later)
          activeNwcConnection.decryptedSecret = secret; // Keep decrypted in memory cache

          return { success: true, name: name, pubkey: pubkey, relay: relay };

      } catch (error) {
          console.error('Failed to connect NWC:', error);
          return { success: false, error: `Connection failed: ${error.message}` };
      }
  });

  ipcMain.handle('nwc-set-active', async(event, pubkey) => {
    const connections = store.get(NWC_CONNECTIONS_KEY, []);
    const connection = connections.find(c => c.pubkey === pubkey);
    if (connection) {
        try {
            activeNwcConnection = connection;
            activeNwcConnection.decryptedSecret = safeStorage.decryptString(Buffer.from(connection.secret, 'base64'));
            console.log('Set active NWC connection:', connection.name);
            return { success: true, name: connection.name };
        } catch(error) {
            console.error('Failed to decrypt secret for NWC connection:', error);
            activeNwcConnection = null;
            return { success: false, error: 'Failed to decrypt secret for this connection.'};
        }
    } else {
        activeNwcConnection = null;
        return { success: false, error: 'Connection not found.' };
    }
  });

  ipcMain.handle('nwc-get-active', async(event) => {
      if (activeNwcConnection && activeNwcConnection.decryptedSecret) {
          return { name: activeNwcConnection.name, pubkey: activeNwcConnection.pubkey, relay: activeNwcConnection.relay };
      } else {
          // Try to load and decrypt the first available connection if none is active
          const connections = store.get(NWC_CONNECTIONS_KEY, []);
          if (connections.length > 0) {
              const firstConn = connections[0];
               try {
                  activeNwcConnection = firstConn;
                  activeNwcConnection.decryptedSecret = safeStorage.decryptString(Buffer.from(firstConn.secret, 'base64'));
                  console.log('Auto-set first NWC connection as active:', firstConn.name);
                  return { name: activeNwcConnection.name, pubkey: activeNwcConnection.pubkey, relay: activeNwcConnection.relay };
              } catch (error) {
                  console.error('Failed to auto-activate first NWC connection:', error);
                  activeNwcConnection = null;
              }
          }
      }
      return null; // No active connection
  });

  ipcMain.handle('nwc-pay-invoice', async (event, bolt11) => {
    if (!activeNwcConnection || !activeNwcConnection.decryptedSecret) {
        return { success: false, error: 'No active NWC connection.' };
    }
    // Basic invoice validation
    if (!bolt11 || !bolt11.startsWith('ln')) {
        return { success: false, error: 'Invalid Bolt11 invoice provided.' };
    }

    let relayPool = null;
    try {
        const { pubkey, relay, decryptedSecret } = activeNwcConnection;
        const payload = {
            method: 'pay_invoice',
            params: {
                invoice: bolt11
            }
        };

        // Use nostr-tools NIP-47 helpers (requires relay connection)
        console.log(`Attempting to pay invoice via NWC: ${bolt11.substring(0, 20)}...`);
        relayPool = new nostrTools.SimplePool(); // Simple relay pool
        const sk = nostrTools.nip19.nsecEncode(decryptedSecret); // NIP-47 uses nsec format for the secret

        // Create and sign the request event
        const reqEvent = await nostrTools.nip47.makeRequestEvent(pubkey, payload, sk);

        // Send event and wait for response
        // This is a simplified version; real implementation needs robust timeout/error handling
        console.log(`Sending NWC request to relay: ${relay}`);
        const responseEvent = await nostrTools.nip47.sendRequest(relayPool, [relay], reqEvent);
        console.log('Received NWC response event:', responseEvent);

        await relayPool.close([relay]); // Close connection

        // Process response
        const responsePayload = await nostrTools.nip47.parseResponseEvent(responseEvent, reqEvent.id, sk);

        if (responsePayload.error) {
            console.error('NWC payment failed:', responsePayload.error);
            return { success: false, error: responsePayload.error.message || 'Payment failed (unknown NWC error)' };
        } else {
            console.log('NWC payment successful. Preimage:', responsePayload.result?.preimage);
            return { success: true, preimage: responsePayload.result?.preimage };
        }

    } catch (error) {
        console.error('Error during NWC pay_invoice:', error);
        if (relayPool) {
            try { await relayPool.close([activeNwcConnection.relay]); } catch (_) {}
        }
        return { success: false, error: `NWC communication error: ${error.message}` };
    }
  });

  ipcMain.handle('nwc-disconnect', async (event, pubkey) => {
      const connections = store.get(NWC_CONNECTIONS_KEY, []);
      const updatedConnections = connections.filter(c => c.pubkey !== pubkey);
      store.set(NWC_CONNECTIONS_KEY, updatedConnections);

      if (activeNwcConnection && activeNwcConnection.pubkey === pubkey) {
          activeNwcConnection = null; // Clear active connection if it was the one disconnected
      }
      console.log(`Disconnected and removed NWC connection for pubkey starting with ${pubkey.substring(0, 6)}...`);
      return { success: true };
  });

  // --- End NWC IPC Handlers ---
}

// --- App Lifecycle ---
app.whenReady().then(() => {
  console.log('App ready, creating window...');
  // No delay needed now as we don't wait for external processes
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    console.log('All windows closed. Quitting app.');
    // No need to kill external processes anymore
    /*
    if (bitcoindProcess && !bitcoindProcess.killed) bitcoindProcess.kill();
    if (lndProcess && !lndProcess.killed) lndProcess.kill();
    if (lnbitsProcess && !lnbitsProcess.killed) lnbitsProcess.kill();
    if (nostrRelayProcess && !nostrRelayProcess.killed) nostrRelayProcess.kill();
    */
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Optional: Handle termination signals gracefully
process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down...');
    // No need to kill external processes anymore
    /*
    if (bitcoindProcess && !bitcoindProcess.killed) bitcoindProcess.kill();
    if (lndProcess && !lndProcess.killed) lndProcess.kill();
    if (lnbitsProcess && !lnbitsProcess.killed) lnbitsProcess.kill();
    if (nostrRelayProcess && !nostrRelayProcess.killed) nostrRelayProcess.kill();
    */
    process.exit(0);
}); 