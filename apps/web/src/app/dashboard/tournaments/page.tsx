'use client';

/**
 * Tournament Management — Feature 7
 *
 * Course managers can create, view, and manage tournaments.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDashboard } from '../layout';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PRIMARY = '#1B6B3A';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  format: string;
  status: string;
  startDate: string;
  endDate: string;
  maxEntrants: number;
  currentEntrants: number;
  createdAt: string;
}

export default function TournamentsPage() {
  const ctx = useDashboard();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('stroke_play');
  const [maxEntrants, setMaxEntrants] = useState('64');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTournaments = useCallback(async () => {
    if (!ctx) return;
    try {
      const res = await fetch(`${API_URL}/v1/tournaments?courseId=${ctx.courseId}`, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTournaments(json.data ?? []);
      }
    } catch {} finally { setLoading(false); }
  }, [ctx]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const handleCreate = async () => {
    if (!ctx || !name.trim() || !startDate || !endDate) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/v1/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.accessToken}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          courseId: ctx.courseId,
          format,
          maxEntrants: Number(maxEntrants) || 64,
          startDate,
          endDate,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName('');
        setDescription('');
        setFormat('stroke_play');
        setMaxEntrants('64');
        setStartDate('');
        setEndDate('');
        fetchTournaments();
      }
    } catch {} finally { setCreating(false); }
  };

  const handleComplete = async (tournamentId: string) => {
    if (!ctx || !confirm('End this tournament and finalize results?')) return;
    try {
      await fetch(`${API_URL}/v1/tournaments/${tournamentId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      fetchTournaments();
    } catch {}
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#dcfce7', text: '#16a34a' },
    live: { bg: '#fef3c7', text: '#d97706' },
    completed: { bg: '#f3f4f6', text: '#6b7280' },
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 14,
    color: '#111',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700 as const,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    display: 'block' as const,
  };

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', margin: 0 }}>Tournaments</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            border: 'none',
            background: PRIMARY,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + New Tournament
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          border: '2px solid ' + PRIMARY,
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>Create Tournament</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Tournament Name</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Championship" />
            </div>
            <div>
              <label style={labelStyle}>Format</label>
              <select
                style={inputStyle}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="stroke_play">Stroke Play</option>
                <option value="net_stroke_play">Net Stroke Play</option>
                <option value="match_play">Match Play</option>
                <option value="scramble">Scramble</option>
                <option value="best_ball">Best Ball</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' as const, fontFamily: 'inherit' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about the tournament..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Max Entrants</label>
              <input style={inputStyle} type="number" value={maxEntrants} onChange={(e) => setMaxEntrants(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !startDate || !endDate}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Tournament'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tournament List */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading tournaments...</p>
      ) : tournaments.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 40,
          border: '1px solid #e5e7eb', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>No tournaments yet</h3>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>
            Create your first tournament to attract competitive golfers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {tournaments.map((t) => {
            const sc = statusColors[t.status] ?? statusColors.open;
            return (
              <div key={t.id} style={{
                background: '#fff', borderRadius: 16, padding: 20,
                border: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>{t.name}</h3>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: sc.text, background: sc.bg,
                      padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase',
                    }}>
                      {t.status === 'live' ? '🔴 LIVE' : t.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {t.format.replace(/_/g, ' ')} · {t.currentEntrants}/{t.maxEntrants} entrants ·{' '}
                    {new Date(t.startDate).toLocaleDateString()} — {new Date(t.endDate).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`/dashboard/tournaments/${t.id}`}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                      background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13,
                      textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    View
                  </a>
                  {(t.status === 'open' || t.status === 'live') && (
                    <button
                      onClick={() => handleComplete(t.id)}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: 'none',
                        background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      End
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
