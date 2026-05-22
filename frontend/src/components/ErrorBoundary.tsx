import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-6 py-10">
          <div className="w-14 h-14 rounded-full bg-danger-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="text-danger-400" size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-sm text-gray-400 max-w-md mb-1">
            A component crashed unexpectedly. This is likely a data issue (e.g. a field returning null).
          </p>
          {this.state.error && (
            <pre className="mt-3 text-xs text-danger-400 bg-danger-500/10 border border-danger-500/20 rounded-lg px-4 py-3 max-w-lg overflow-auto text-left whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="mt-6 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={15} />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
