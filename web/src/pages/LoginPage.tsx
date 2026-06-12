import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import surveyStudioLogo from "../assets/survey-studio-logo.png";
import { apiRequest } from "../lib/api";
import { setToken } from "../lib/auth";

type LoginResponse = {
  token: string;
};

export default function LoginPage() {
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
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(data.token);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
          <p className="eyebrow">Feedback, thoughtfully presented</p>
          <h1>Surveys that feel like your product.</h1>
          <p>Create focused, branded experiences and turn every submission into useful context.</p>
        </div>
        <p className="field-hint">Simple to build. Comfortable to answer.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form-card">
          <h2>Welcome back</h2>
          <p>Log in to manage your surveys and responses.</p>
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <p className="status-message status-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="auth-switch">
            New to Survey Studio? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
