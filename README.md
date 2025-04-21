# Aster Browser

A privacy-focused web browser integrated with Nostr and Lightning Network features.

## Features

*   Standard web browsing capabilities.
*   Built-in Nostr NIP-07 extension:
    *   Secure key generation and storage (using `electron-store` and `safeStorage`).
    *   Login with existing `nsec` or create a new one.
    *   Handles `getPublicKey`, `signEvent`, `getRelays`, `nip04.encrypt`, `nip04.decrypt` requests from websites.
    *   Logout functionality.
*   Nostr Wallet Connect (NIP-47) integration:
    *   Connect to NWC-compatible wallets using `nostr+walletconnect:` URIs.
    *   Securely stores connection details.
    *   List, activate, and disconnect saved wallet connections.
    *   Pay BOLT11 Lightning invoices via the active NWC connection.
*   Optional ad display with potential for Lightning Network rewards (currently placeholder/disabled).
*   Basic ad blocking (currently placeholder/disabled due to dependencies).

## Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Run the browser: `npm start`

## Development Notes

*   Built with Electron.
*   Uses `electron-store` for persistent data (Nostr keys, NWC connections).
*   Uses `safeStorage` for encrypting sensitive data before storing.
*   Requires `nostr-tools` for Nostr protocol interactions. 