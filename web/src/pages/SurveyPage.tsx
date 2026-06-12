import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

type SurveyQuestion = {
  id: string;
  question_order: number;
  type: "short_text" | "multiple_choice" | "rating";
  prompt: string;
  options: string[] | null;
};

type Survey = {
  id: string;
  slug: string;
  title: string;
  primary_color: string;
  logo_url: string | null;
  questions: SurveyQuestion[];
};

function getContrastColor(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.62 ? "#18181b" : "#ffffff";
}

export default function SurveyPage() {
  const [slug, setSlug] = useState("");
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSlug(window.location.pathname.split("/").pop() || "");
  }, []);

  useEffect(() => {
    if (!slug) return;
    apiRequest<Survey>(`/survey/${slug}`)
      .then(setSurvey)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load survey"))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!survey) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiRequest(`/survey/${slug}/response`, {
        method: "POST",
        body: {
          answers: survey.questions.map((question) => ({
            questionId: question.id,
            value: answers[question.id] ?? "",
          })),
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestion(question: SurveyQuestion) {
    const value = answers[question.id] ?? "";

    if (question.type === "short_text") {
      return (
        <textarea
          className="textarea public-textarea"
          value={value}
          onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
          placeholder="Type your answer here..."
          aria-label={question.prompt}
        />
      );
    }

    if (question.type === "multiple_choice") {
      return (
        <div className="choice-list">
          {question.options?.map((option) => (
            <label className={`choice ${value === option ? "choice-selected" : ""}`} key={option}>
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => setAnswers({ ...answers, [question.id]: option })}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <div className="rating-list">
        {[1, 2, 3, 4, 5].map((score) => (
          <label
            className={`choice rating-choice ${value === String(score) ? "choice-selected" : ""}`}
            key={score}
          >
            <input
              type="radio"
              name={question.id}
              value={String(score)}
              checked={value === String(score)}
              onChange={() => setAnswers({ ...answers, [question.id]: String(score) })}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
    );
  }

  if (loading) {
    return <div className="loading-block">Loading survey...</div>;
  }

  if (error && !survey) {
    return (
      <main className="error-page">
        <div className="error-card">
          <p className="eyebrow">Survey unavailable</p>
          <h1 className="panel-title">We could not open this survey</h1>
          <p className="page-description">{error}</p>
        </div>
      </main>
    );
  }

  if (!survey) {
    return <div className="loading-block">Survey not found.</div>;
  }

  const accentStyle = {
    "--accent": survey.primary_color,
    "--accent-contrast": getContrastColor(survey.primary_color),
  } as React.CSSProperties;

  if (submitted) {
    return (
      <main className="completion-page" style={accentStyle}>
        <section className="completion-card">
          <div className="completion-check" aria-hidden="true">
            &#10003;
          </div>
          <h1>Response received</h1>
          <p>Thank you for taking the time to complete {survey.title}.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="public-survey" style={accentStyle}>
      <div className="public-accent-line" />
      <div className="public-survey-inner">
        <header>
          <div className="survey-logo">
            {survey.logo_url ? (
              <img src={survey.logo_url} alt={`${survey.title} logo`} />
            ) : (
              survey.title.slice(0, 1).toUpperCase()
            )}
          </div>
          <h1 className="public-title">{survey.title}</h1>
          <p className="public-intro">
            We value your perspective. Please share your honest feedback below.
          </p>
        </header>

        <div className="public-divider" />

        <form className="public-form" onSubmit={handleSubmit}>
          {survey.questions.map((question, index) => (
            <fieldset className="public-question" key={question.id}>
              <legend className="public-question-header">
                <span className="public-question-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="public-question-title">{question.prompt}</span>
              </legend>
              {renderQuestion(question)}
            </fieldset>
          ))}

          {error && (
            <p className="status-message status-error" role="alert">
              {error}
            </p>
          )}

          <div className="public-submit-row">
            <span className="public-meta">Your responses are submitted securely.</span>
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit response"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
