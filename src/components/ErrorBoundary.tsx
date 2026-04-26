import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{
          width: '100vw', height: '100vh', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: 'var(--cc-bg)',
          padding: 40,
        }}>
          <div style={{
            maxWidth: 520, background: 'var(--cc-bg-raised)',
            border: '1px solid var(--cc-line)', borderRadius: 14,
            padding: '28px 32px', boxShadow: '0 24px 80px rgba(31,27,22,0.15)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#FFF4EC', color: 'var(--cc-orange-deep)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 600, marginBottom: 14,
            }}>!</div>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>界面渲染出错</h1>
            <div style={{ fontSize: 13, color: 'var(--cc-ink-soft)', lineHeight: 1.6, marginBottom: 10 }}>
              {this.state.error.message || '未知错误'}
            </div>
            <pre style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              background: 'var(--cc-bg-sunk)', padding: 10, borderRadius: 7,
              color: 'var(--cc-muted)', maxHeight: 180, overflow: 'auto',
              marginBottom: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{this.state.error.stack || this.state.error.toString()}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="cc-btn" onClick={() => location.reload()}>重新加载</button>
              <button className="cc-btn primary" onClick={this.reset}>继续使用</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
