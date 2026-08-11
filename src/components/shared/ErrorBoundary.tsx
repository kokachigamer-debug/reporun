import { Component, type ErrorInfo, type ReactNode } from "react";

// Section 23: error boundary specifically around the generated-interface
// rendering so a malformed repo's classification/form never crashes the app.
export class InterfaceErrorBoundary extends Component<
  { children: ReactNode; onReport?: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[reporun] interface error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="rr-card max-w-md space-y-3 p-5">
            <h2 className="text-base font-semibold text-rr-text">
              Something went wrong rendering this repo
            </h2>
            <p className="text-xs text-rr-subtle">
              {(this.state.error as Error).message}
            </p>
            <div className="flex gap-2">
              <button
                className="rr-btn-ghost"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
              <button
                className="rr-btn-ghost"
                onClick={this.props.onReport}
              >
                Report misclassification
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
