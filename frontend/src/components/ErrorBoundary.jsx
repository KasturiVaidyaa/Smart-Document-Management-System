import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * React Error Boundary — catches JavaScript errors anywhere in the child
 * component tree. Displays a fallback UI so the entire app doesn't crash.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-8">
          <div className="w-full max-w-md rounded-2xl border border-rose-800/40 bg-zinc-900 p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
              <AlertTriangle className="h-7 w-7 text-rose-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-zinc-400 mb-1">
              An unexpected error occurred in this section.
            </p>
            {this.state.error && (
              <p className="mt-3 mb-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-rose-300 text-left break-all">
                {this.state.error.toString()}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
