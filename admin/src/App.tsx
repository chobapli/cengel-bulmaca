import { useState } from 'react';
import { generateAndSavePuzzle } from './services/puzzleGenerator';
import './App.css';

interface GeneratedWord {
  word: string;
  clue: string;
  direction: 'across' | 'down';
  number: number;
}

function App() {
  const [apiKey, setApiKey] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [generatedWords, setGeneratedWords] = useState<GeneratedWord[]>([]);

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setMessage('Claude API anahtarını gir');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setMessage('Kelimeler üretiliyor...');
    setGeneratedWords([]);
    try {
      const puzzle = await generateAndSavePuzzle(apiKey, targetDate);
      setGeneratedWords(puzzle.words);
      setStatus('success');
      setMessage(`✓ ${targetDate} için bulmaca oluşturuldu ve kaydedildi (${puzzle.words.length} kelime)`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Hata oluştu');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: 12 }}>Çengel Bulmaca — Admin Panel</h1>

      <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Günlük Bulmaca Üret</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Tarih</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
          />
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
            background: status === 'loading' ? '#888' : '#2563eb',
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
      </div>

      {generatedWords.length > 0 && (
        <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Oluşturulan Kelimeler</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3>Yatay</h3>
              {generatedWords.filter(w => w.direction === 'across').map(w => (
                <div key={`${w.number}-across`} style={{ marginBottom: 8 }}>
                  <strong>{w.number}. {w.word}</strong> — {w.clue}
                </div>
              ))}
            </div>
            <div>
              <h3>Dikey</h3>
              {generatedWords.filter(w => w.direction === 'down').map(w => (
                <div key={`${w.number}-down`} style={{ marginBottom: 8 }}>
                  <strong>{w.number}. {w.word}</strong> — {w.clue}
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
