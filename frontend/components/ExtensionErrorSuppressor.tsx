'use client';

import { useEffect } from 'react';

/**
 * Suppresses unhandled errors thrown by browser extensions (MetaMask, etc.)
 * that inject scripts into the page. These errors originate from extension
 * content scripts (inpage.js) and are not related to the app.
 */
export default function ExtensionErrorSuppressor() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const src = event.filename ?? '';
      const msg = event.message ?? '';
      if (
        src.includes('chrome-extension://') ||
        src.includes('moz-extension://') ||
        msg.includes('MetaMask') ||
        msg.includes('ethereum') ||
        msg.includes('web3')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message ?? event.reason ?? '');
      const stack = String(event.reason?.stack ?? '');
      if (
        msg.includes('MetaMask') ||
        msg.includes('Failed to connect to MetaMask') ||
        msg.includes('ethereum') ||
        msg.includes('web3') ||
        stack.includes('inpage.js') ||
        stack.includes('chrome-extension://') ||
        stack.includes('moz-extension://')
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
