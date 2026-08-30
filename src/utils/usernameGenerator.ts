/**
 * Generates a random username using the randomuser.me API.
 * Endpoint: https://randomuser.me/api
 * Extracts: response.results[0].login.username
 */
export async function generateRandomUsername(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://randomuser.me/api', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.results?.[0]?.login?.username) {
        return data.results[0].login.username.trim();
      }
    }
  } catch (e) {
    console.warn('Failed to fetch random username from randomuser.me API:', e);
  }

  // Safe offline fallback
  const prefixes = ['swift', 'hyper', 'iron', 'titan', 'apex', 'cyber', 'blaze', 'alpha'];
  const nouns = ['tiger', 'falcon', 'runner', 'warrior', 'squatter', 'beast', 'viper', 'crusher'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${p}_${n}${num}`;
}
