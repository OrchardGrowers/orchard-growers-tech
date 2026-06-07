import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("eFruitMandi route render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#eef3ef] px-4">
          <section className="w-full max-w-md rounded-md border border-green-100 bg-white p-5 text-center shadow-sm">
            <h1 className="text-lg font-black text-gray-950">Page could not load</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-600">
              Please refresh the page. If this continues, return to the dashboard and open the lot again.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-extrabold text-white"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/profile-dashboard";
                }}
                className="rounded-md bg-green-50 px-4 py-2 text-sm font-extrabold text-green-800"
              >
                Dashboard
              </button>
            </div>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
