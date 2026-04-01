export default function NotFound() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#1a7f4b' }}>404</h1>
      <p style={{ color: '#6b7280', fontSize: '1.1rem', marginTop: '1rem' }}>Page not found</p>
      <a href="/" style={{ display: 'inline-block', marginTop: '2rem', color: '#1a7f4b', fontWeight: 600 }}>
        Go home →
      </a>
    </div>
  );
}
