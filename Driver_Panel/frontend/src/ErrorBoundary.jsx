import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    
    console.error('Runtime error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, maxWidth: 600, margin: '40px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fee', padding: 12, borderRadius: 8, border: '1px solid #fca5a5' }}>
            {String(this.state.error)}
          </pre>
          <p style={{ color: '#6b7280' }}>Please screenshot this and share. Try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
