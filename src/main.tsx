import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { Database } from './db/sqlite'
import { ShieldAlert } from 'lucide-react'

// Professional "Rescue UI" - Prevents White Screen of Death
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any, recovering: boolean}> {
  constructor(props: any) { 
    super(props); 
    this.state = { hasError: false, error: null, recovering: false }; 
  }
  
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }

  handleRecovery = async () => {
    this.setState({ recovering: true });
    // Execute the Nuclear Reset requested in the expert-grade plan
    await Database.nuclearReset();
  };

  render() {
    if (this.state.hasError) {
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
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
        }}>
          {/* Rescue Icon */}
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            padding: '24px', 
            borderRadius: '24px', 
            marginBottom: '32px' 
          }}>
            <ShieldAlert size={48} color="#ef4444" />
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.025em', marginBottom: '8px', textTransform: 'uppercase' }}>
            DATABASE BOOT ERROR
          </h1>
          
          <p style={{ color: '#9ca3af', fontSize: '15px', maxWidth: '300px', lineHeight: '1.5', marginBottom: '40px' }}>
            {this.state.error?.message || 'Database connection lost or schema mismatch detected.'}
          </p>

          <div style={{ color: '#374151', fontSize: '12px', marginBottom: '48px' }}>
             System v1.3.3 — (If visible, please CTRL+F5 to Hard Refresh)
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
                opacity: this.state.recovering ? 0.5 : 1
              }}>
              {this.state.recovering ? 'Reparing System...' : 'Attempt System Recovery'}
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
                cursor: 'pointer'
              }}>
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
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
