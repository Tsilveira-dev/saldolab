const key = 'saldolab:preferences:v1';
export function readPreferences() {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    const cloudMode = value.mode === 'cloud' && import.meta.env.VITE_NEON_AUTH_URL;
    return {
      mode: cloudMode ? 'cloud' : 'personal',
      theme: value.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { mode: 'personal', theme: 'light' };
  }
}
export function savePreferences(value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Financial persistence reports storage errors separately. */
  }
}
