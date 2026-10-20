// ErrorBoundary.tsx — catches render errors anywhere below it instead
// of letting React unmount the whole tree, which is what happened the
// time a single malformed BeatSaver response crashed SongList.tsx and
// took the entire app down to a blank white screen with no way back
// short of a manual URL edit. React only supports this via a class
// component (getDerivedStateFromError/componentDidCatch have no hook
// equivalent as of React 19) — everything else in this codebase can
// stay function components, this one file is the deliberate exception.
//
// Only catches errors thrown while RENDERING (including effects) —
// not errors in event handlers (those still need their own try/catch,
// e.g. the askApiKey/postToPool flows already do), and not rejected
// promises that nothing ever awaits.
import React from "react";
import { Link, useLocation } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryImpl extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Goes to the browser console, same place every other fetch
    // failure in this app already logs to (see fetchSongsByHashes's
    // own console.warn) — no error-reporting backend to send this to.
    console.error("Unhandled error in a React component:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="w-full max-w-screen-2xl mx-auto px-6 py-16 flex justify-center">
          <div
            className="pixel-card pixel-card-static pixel-page-flyin"
            style={{ padding: 28, maxWidth: 520, textAlign: "center" }}
          >
            <div className="pixel-font text-[14px] text-red-400 mb-4">
              !! SOMETHING WENT WRONG !!
            </div>
            <div className="text-sm text-[#b7c0d6] mb-2">
              This page hit an error it couldn't recover from.
            </div>
            <div className="text-xs text-[#6a7690] font-mono mb-6 break-words">
              {this.state.error.message}
            </div>
            <div className="flex items-center justify-center gap-3">
              <button className="pixel-btn" onClick={this.reset}>
                Try Again
              </button>
              {/* No reset handler needed here — navigating changes the
                  route, which remounts this boundary fresh (see the
                  key={location.pathname} wrapper below) rather than
                  reusing this now-stale instance. */}
              <Link to="/" className="pixel-tab">
                ALL POOLS
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Thin wrapper around the class boundary above: keying it by the
// current route means navigating anywhere else remounts it fresh,
// clearing a caught error automatically — "Try Again" (same route) and
// "ALL POOLS" (different route) end up covering both recovery paths
// without needing router-aware logic inside the class component
// itself, which can't use hooks.
const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  return <ErrorBoundaryImpl key={location.pathname}>{children}</ErrorBoundaryImpl>;
};

export default ErrorBoundary;
