import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Catches render-time crashes so a single broken screen doesn't blank the app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bone p-6 text-center">
        <div className="text-2xl font-bold text-ink">เกิดข้อผิดพลาด</div>
        <p className="text-sm text-ink/60">ระบบขัดข้องชั่วคราว กรุณาโหลดหน้าใหม่อีกครั้ง</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-[44px] rounded-lg bg-amber-brand px-6 font-semibold text-white hover:bg-amber-deep"
        >
          โหลดใหม่
        </button>
      </div>
    );
  }
}
