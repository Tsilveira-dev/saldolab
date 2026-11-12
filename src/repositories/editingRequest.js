const key = 'saldolab:editing-request:v1';

// This is a one-use navigation intent, never a financial dataset or a lock.
export function rememberEditingRequest({ mode, month, accountId }) {
  window.sessionStorage.setItem(key, JSON.stringify({ mode, month, accountId }));
}

export function takeEditingRequest() {
  try {
    const raw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    if (window.performance.getEntriesByType('navigation')[0]?.type !== 'reload') return null;
    const request = JSON.parse(raw);
    return ['demo', 'personal'].includes(request?.mode) ? request : null;
  } catch {
    return null;
  }
}

export function clearEditingRequest() {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Reading remains available when session storage is disabled.
  }
}
