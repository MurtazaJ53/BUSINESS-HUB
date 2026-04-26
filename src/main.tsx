import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { Database } from './db/sqlite'
import { ShieldAlert } from 'lucide-react'
import AppPopupHost from './components/AppPopupHost'

const CHUNK_RECOVERY_KEY = 'hub_chunk_recovery_at';

const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError')
  );
};

const attemptChunkRecovery = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const lastRecoveryAt = Number(sessionStorage.getItem(CHUNK_RECOVERY_KEY) || '0');
  if (lastRecoveryAt && Date.now() - lastRecoveryAt <= 30000) {
    return false;
  }

  sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));
  window.location.reload();
  return true;
};

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    attemptChunkRecovery();
  });

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error || event.message)) {
      event.preventDefault();
      attemptChunkRecovery();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      attemptChunkRecovery();
    }
  });
}

// Professional "Rescue UI" - Prevents White Screen of Death
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any, recovering: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  handleRecovery = async () => {
    this.setState({ recovering: true });
    if (isChunkLoadError(this.state.error)) {
      sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
      window.location.reload();
      return;
    }

    await Database.nuclearReset();
  };

  render() {
    if (this.state.hasError) {
      const isStaleUiError = isChunkLoadError(this.state.error);
      return (
        <div style={{
          background: '#000',
          color: '#fff',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '24px',
            borderRadius: '24px',
            marginBottom: '32px',
          }}>
            <ShieldAlert size={48} color="#ef4444" />
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.025em', marginBottom: '8px', textTransform: 'uppercase' }}>
            {isStaleUiError ? 'APP UPDATE REQUIRED' : 'DATABASE BOOT ERROR'}
          </h1>

          <p style={{ color: '#9ca3af', fontSize: '15px', maxWidth: '300px', lineHeight: '1.5', marginBottom: '40px' }}>
            {isStaleUiError
              ? 'This tab is using an older app bundle. Reload to reconnect to the latest UI safely.'
              : (this.state.error?.message || 'Database connection lost or schema mismatch detected.')}
          </p>

          <div style={{ color: '#374151', fontSize: '12px', marginBottom: '48px' }}>
            System v1.3.3 - If visible, please hard refresh the app once.
          </div>

          <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={this.handleRecovery}
              disabled={this.state.recovering}
              style={{
                width: '100%',
                padding: '16px',
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                borderRadius: '16px',
                fontWeight: 'bold',
                fontSize: '14px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                opacity: this.state.recovering ? 0.5 : 1,
              }}
            >
              {this.state.recovering
                ? (isStaleUiError ? 'Reloading UI...' : 'Repairing System...')
                : (isStaleUiError ? 'Reload Latest UI' : 'Attempt System Recovery')}
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '16px',
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#9ca3af',
                borderRadius: '16px',
                fontWeight: 'bold',
                fontSize: '14px',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Standard Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppPopupHost />
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
