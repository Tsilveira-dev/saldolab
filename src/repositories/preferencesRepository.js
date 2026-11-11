const key = 'saldolab:preferences:v1';
export function readPreferences() {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    return {
      mode: value.mode === 'personal' ? 'personal' : 'demo',
      theme: value.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { mode: 'demo', theme: 'light' };
  }
}
export function savePreferences(value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Financial persistence reports storage errors separately. */
  }
}
