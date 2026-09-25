import { useState } from "react";
import { UserData } from "../context/UserContext";
import { useNavigate, Link } from "react-router-dom";
import { FileText, Mail } from "lucide-react";

const Forgot = () => {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const { btnLoading, forgotUser } = UserData();
  const navigate = useNavigate();

  const submitHandler = (e) => {
    e.preventDefault();
    if (!email.trim()) { setFormError("Please enter your email address."); return; }
    setFormError("");
    forgotUser(email, navigate);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-blue-600/6 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-950/50 mb-4">
              <FileText className="h-6 w-6 text-white" />
            </span>
            <h1 className="text-xl font-bold text-zinc-100">Reset password</h1>
            <p className="mt-2 text-sm text-zinc-500 text-center max-w-xs">
              Enter your account email and we'll send you a one-time reset link.
            </p>
          </div>

          {formError && (
            <div className="mb-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
              {formError}
            </div>
          )}

          <form onSubmit={submitHandler} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
            </div>

            <button type="submit" disabled={btnLoading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500 disabled:opacity-60 transition-all">
              {btnLoading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Remember your password?{" "}
            <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Forgot;