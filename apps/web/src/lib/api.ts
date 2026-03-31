const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach auth token from localStorage if available (client-side only)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sb-access-token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
