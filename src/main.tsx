import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { Database } from './db/sqlite'

// Emergency Error Boundary to prevent White Screen of Death
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#000', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'black', marginBottom: '10px' }}>SYSTEM CRITICAL ERROR</h1>
            <p style={{ color: '#666', fontSize: '12px' }}>{this.state.error?.message || 'Unknown Boot Failure'}</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#333', border: 'none', color: '#fff', borderRadius: '8px' }}>Force Restart</button>
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
