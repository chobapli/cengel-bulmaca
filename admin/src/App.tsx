import { useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './config/firebase';
import { generateAndSavePuzzle } from './services/puzzleGenerator';
import './App.css';

interface GeneratedWord {
  id: number;
  word: string;
  clue: string;
  direction: 'right' | 'down';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [generatedWords, setGeneratedWords] = useState<GeneratedWord[]>([]);
  const [gridInfo, setGridInfo] = useState<{ rows: number; cols: number } | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setMessage('Claude API anahtarını gir');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setMessage('Kelimeler üretiliyor ve yerleştiriliyor...');
    setGeneratedWords([]);
    setGridInfo(null);
    try {
      const puzzle = await generateAndSavePuzzle(apiKey, targetDate);
      setGeneratedWords(puzzle.words as GeneratedWord[]);
      setGridInfo({ rows: puzzle.gridRows, cols: puzzle.gridCols });
      setStatus('success');
      setMessage(
        `✓ ${targetDate} için bulmaca oluşturuldu — ${puzzle.words.length} kelime, ${puzzle.gridRows}×${puzzle.gridCols} grid`
      );
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Hata oluştu');
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <h1>Çengel Bulmaca</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>Admin paneline erişmek için giriş yapın.</p>
        <button
          onClick={handleLogin}
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}
        >
          Google ile Giriş Yap
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Çengel Bulmaca — Admin Panel</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#666' }}>{user.email}</span>
          <button onClick={() => signOut(auth)} style={{ background: '#e5e7eb', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
            Çıkış
          </button>
        </div>
      </div>

      {/* Bulmaca üretici */}
      <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Günlük Bulmaca Üret</h2>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Tarih</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Claude API Anahtarı</label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          style={{
            background: status === 'loading' ? '#888' : '#e91e8c',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 6,
            fontSize: 15,
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {status === 'loading' ? 'Üretiliyor...' : 'Bulmaca Üret ve Kaydet'}
        </button>

        {message && (
          <p style={{ marginTop: 16, color: status === 'error' ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
            {message}
          </p>
        )}

        {gridInfo && (
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Grid boyutu: {gridInfo.rows} satır × {gridInfo.cols} sütun
          </p>
        )}
      </div>

      {/* Oluşturulan kelimeler */}
      {generatedWords.length > 0 && (
        <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Yerleştirilen Kelimeler ({generatedWords.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={{ color: '#be185d' }}>→ Yatay</h3>
              {generatedWords.filter((w) => w.direction === 'right').map((w) => (
                <div key={w.id} style={{ marginBottom: 8, fontSize: 14 }}>
                  <strong>{w.word}</strong> — {w.clue}
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ color: '#1d4ed8' }}>↓ Dikey</h3>
              {generatedWords.filter((w) => w.direction === 'down').map((w) => (
                <div key={w.id} style={{ marginBottom: 8, fontSize: 14 }}>
                  <strong>{w.word}</strong> — {w.clue}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
