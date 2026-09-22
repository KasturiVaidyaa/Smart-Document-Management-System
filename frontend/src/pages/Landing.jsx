import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <h1 className="text-xl font-bold text-blue-400">Smart Cloud DMS</h1>
        <div className="space-x-3">
          <Link to="/login" className="px-4 py-2 text-zinc-200 hover:text-white">
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500"
          >
            Sign up
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-5xl font-bold">Store, search, and share documents securely</h2>
        <p className="mt-6 text-lg text-zinc-300">
          One account with a personal workspace plus optional organizations. Access
          control, versioning, and AI search come next — this first step is a solid
          auth and workspace foundation.
        </p>
        <div className="mt-8 space-x-4">
          <Link
            to="/register"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold hover:bg-blue-500"
          >
            Get started
          </Link>
          <Link
            to="/login"
            className="inline-block rounded-lg border border-zinc-600 px-8 py-3 font-semibold hover:bg-zinc-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
