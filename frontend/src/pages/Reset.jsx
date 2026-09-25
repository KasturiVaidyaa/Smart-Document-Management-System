import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { FileText, Eye, EyeOff, Lock, KeyRound } from "lucide-react";

const getStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const strengthLabel = ["Very weak", "Weak", "Medium", "Strong", "Excellent"];
const strengthColor = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

const Reset = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState("");

  const { resetUser, btnLoading } = UserData();
  const navigate = useNavigate();
  const { token } = useParams();

  const strength = getStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordsMismatch = password && confirmPassword && password !== confirmPassword;

  const submitHandler = (e) => {
    e.preventDefault();
    if (!otp.trim() || !password.trim() || !confirmPassword.trim()) {
      setFormError("All fields are required."); return;
    }
    if (otp.length !== 6) { setFormError("Verification code must be 6 digits."); return; }
    if (password.length < 8) { setFormError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setFormError("Passwords do not match."); return; }
    setFormError("");
    resetUser(token, otp, password, navigate);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-blue-600/6 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-950/50 mb-4">
              <FileText className="h-6 w-6 text-white" />
            </span>
            <h1 className="text-xl font-bold text-zinc-100">Set new password</h1>
            <p className="mt-1.5 text-sm text-zinc-500 text-center max-w-xs">
              Enter the 6-digit code from your email and choose a new password.
            </p>
          </div>

          {formError && (
            <div className="mb-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
              {formError}
            </div>
          )}

          <form onSubmit={submitHandler} className="space-y-4">
            {/* OTP */}
            <div>
              <label htmlFor="otp" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Verification Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    if (v.length <= 6) setOtp(v);
                  }}
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition text-center tracking-[0.3em] font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
              {otp.length > 0 && otp.length < 6 && (
                <p className="text-[11px] text-zinc-600 mt-1">{6 - otp.length} digits remaining</p>
              )}
            </div>

            {/* New password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${strength > i ? strengthColor[strength] : "bg-zinc-700"}`} />
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500">{strengthLabel[strength]}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 pointer-events-none" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat password"
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:ring-2 bg-zinc-800 ${
                    passwordsMismatch
                      ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/15"
                      : passwordsMatch
                      ? "border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/15"
                      : "border-zinc-700 focus:border-blue-500 focus:ring-blue-500/15"
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordsMatch && <p className="mt-1 text-[11px] text-emerald-400">✓ Passwords match</p>}
              {passwordsMismatch && <p className="mt-1 text-[11px] text-rose-400">Passwords don't match</p>}
            </div>

            <button type="submit" disabled={btnLoading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500 disabled:opacity-60 transition-all mt-2">
              {btnLoading ? "Resetting…" : "Reset password"}
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

export default Reset;