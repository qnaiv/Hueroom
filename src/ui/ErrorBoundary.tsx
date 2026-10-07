import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** 画面の描画で例外が出たとき、真っ白にせず、原因と読み直しのボタンを出す */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="welcome">
        <div className="welcome-card" role="alert">
          <h1>表示でエラーが出ました</h1>
          <p>ページを読み直すと、直ることがあります。直らないときは、下のメッセージを教えてください。</p>
          <p className="num">{error.message}</p>
          <div className="welcome-actions">
            <button type="button" className="btn primary" onClick={() => location.reload()}>
              読み直す
            </button>
          </div>
        </div>
      </main>
    );
  }
}
