import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import surveyStudioLogo from "../assets/survey-studio-logo.png";
import { apiRequest } from "../lib/api";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/auth/signup", {
        method: "POST",
        body: { email, password },
      });
      navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-context">
        <div className="product-mark">
          <span className="product-mark-symbol">
            <img src={surveyStudioLogo} alt="" />
          </span>
          Survey Studio
        </div>
        <div className="auth-context-copy">
          <p className="eyebrow">Start with a clear question</p>
          <h1>Make feedback easier to give.</h1>
          <p>
            Build polished surveys without wrestling with layout, then review responses in one calm
            workspace.
          </p>
        </div>
        <p className="field-hint">Built for teams who care about the details.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <h2>Create your account</h2>
          <p>Set up a workspace for your branded surveys.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                className="input"
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <p className="field-hint">Use at least 8 characters.</p>
            </div>
            {error && (
              <p className="status-message status-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
