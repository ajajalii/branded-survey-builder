import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import surveyStudioLogo from "../assets/survey-studio-logo.png";
import { apiRequest } from "../lib/api";
import { removeToken } from "../lib/auth";

type MeResponse = {
  id: string;
  email: string;
};

type SurveyListItem = {
  id: string;
  title: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  response_count: number;
  created_at: string;
};

type SurveyResponse = {
  id: string;
  created_at: string;
  answers: Array<{ prompt: string; value: string }>;
};

type SurveyDetail = {
  id: string;
  title: string;
  primary_color: string;
  logo_url: string | null;
  questions: Array<{
    id: string;
    type: QuestionForm["type"];
    prompt: string;
    options: string[] | null;
  }>;
};

type QuestionForm = {
  id: string;
  type: "short_text" | "multiple_choice" | "rating";
  prompt: string;
  options: string[];
};

const questionTypeLabels: Record<QuestionForm["type"], string> = {
  short_text: "Written answer",
  multiple_choice: "Multiple choice",
  rating: "Rating scale",
};

function createQuestion(): QuestionForm {
  return {
    id: crypto.randomUUID(),
    type: "short_text",
    prompt: "",
    options: ["", ""],
  };
}

function getContrastColor(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#18181b" : "#ffffff";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const builderRef = useRef<HTMLElement>(null);
  const responsesRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [logoUrl, setLogoUrl] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([createQuestion()]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedSurveyId, setCopiedSurveyId] = useState<string | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);

  useEffect(() => {
    apiRequest<MeResponse>("/auth/me")
      .then(setUser)
      .catch(() => {
        removeToken();
        navigate({ to: "/login" });
      });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    void refreshSurveys();
  }, [user]);

  useEffect(() => {
    if (!selectedSurveyId) {
      setResponses([]);
      return;
    }

    setLoadingResponses(true);
    apiRequest<{ responses: SurveyResponse[] }>(`/survey/by-id/${selectedSurveyId}/responses`)
      .then((data) => setResponses(data.responses))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load responses"))
      .finally(() => setLoadingResponses(false));
  }, [selectedSurveyId]);

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId]
  );

  const totalResponses = useMemo(
    () => surveys.reduce((total, survey) => total + survey.response_count, 0),
    [surveys]
  );

  const accentStyle = {
    "--accent": primaryColor,
    "--accent-contrast": getContrastColor(primaryColor),
  } as React.CSSProperties;

  function handleLogout() {
    removeToken();
    navigate({ to: "/login" });
  }

  function updateQuestion(index: number, next: Partial<QuestionForm>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...next } : question
      )
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, createQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const sourceQuestion = next[index];
      const targetQuestion = next[target];
      if (!sourceQuestion || !targetQuestion) return current;
      next[index] = targetQuestion;
      next[target] = sourceQuestion;
      return next;
    });
  }

  function addOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex ? { ...question, options: [...question.options, ""] } : question
      )
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? value : option
          ),
        };
      })
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: question.options.filter(
            (_, currentOptionIndex) => currentOptionIndex !== optionIndex
          ),
        };
      })
    );
  }

  async function handleSaveSurvey(event: React.FormEvent) {
    event.preventDefault();
    setBuilderError(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setBuilderError("Add a survey title before publishing.");
      return;
    }

    const invalidQuestion = questions.find((question) => !question.prompt.trim());
    if (invalidQuestion) {
      setBuilderError("Every question needs a prompt.");
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      primary_color: primaryColor,
      logo_url: logoUrl.trim() || undefined,
      questions: questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt.trim(),
        options:
          question.type === "multiple_choice"
            ? question.options.map((option) => option.trim()).filter(Boolean)
            : undefined,
      })),
    };

    try {
      await apiRequest(editingSurveyId ? `/survey/by-id/${editingSurveyId}` : "/survey", {
        method: editingSurveyId ? "PUT" : "POST",
        body: payload,
      });
      setSuccessMessage(
        editingSurveyId ? "Survey changes saved." : "Survey published. It is ready to share."
      );
      resetBuilder();
      await refreshSurveys();
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Failed to create survey");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSurveys() {
    setLoadingSurveys(true);
    try {
      const data = await apiRequest<{ surveys: SurveyListItem[] }>("/survey");
      setSurveys(data.surveys);
      setSelectedSurveyId((current) => current ?? data.surveys[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load surveys");
    } finally {
      setLoadingSurveys(false);
    }
  }

  async function copySurveyLink(survey: SurveyListItem) {
    await navigator.clipboard.writeText(`${window.location.origin}/survey/${survey.slug}`);
    setCopiedSurveyId(survey.id);
    window.setTimeout(() => setCopiedSurveyId(null), 1600);
  }

  function resetBuilder() {
    setEditingSurveyId(null);
    setTitle("");
    setLogoUrl("");
    setPrimaryColor("#2563eb");
    setQuestions([createQuestion()]);
  }

  async function editSurvey(survey: SurveyListItem) {
    setLoadingEditor(true);
    setBuilderError(null);
    setSuccessMessage(null);
    try {
      const detail = await apiRequest<SurveyDetail>(`/survey/${survey.slug}`);
      setEditingSurveyId(detail.id);
      setTitle(detail.title);
      setLogoUrl(detail.logo_url ?? "");
      setPrimaryColor(detail.primary_color);
      setQuestions(
        detail.questions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          options: question.options ?? ["", ""],
        }))
      );
      builderRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : "Failed to open survey editor");
    } finally {
      setLoadingEditor(false);
    }
  }

  function viewResponses(surveyId: string) {
    setSelectedSurveyId(surveyId);
    window.setTimeout(() => responsesRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  if (error) {
    return (
      <main className="error-page">
        <div className="error-card">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="panel-title">We could not load your workspace</h1>
          <p className="page-description">{error}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => location.reload()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return <div className="loading-block">Loading workspace...</div>;
  }

  return (
    <div className="dashboard-shell" style={accentStyle}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="product-mark">
            <span className="product-mark-symbol">
              <img src={surveyStudioLogo} alt="" />
            </span>
            Survey Studio
          </div>
          <div className="account-menu">
            <span className="account-email">{user.email}</span>
            <button className="button button-quiet" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="workspace">
        <header className="page-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="page-title">Surveys</h1>
            <p className="page-description">
              Build branded surveys, share them with confidence, and review every submission.
            </p>
          </div>
          <div className="summary-row" aria-label="Workspace summary">
            <div className="summary-pill">
              <span className="summary-value">{surveys.length}</span>
              <span className="summary-label">Surveys</span>
            </div>
            <div className="summary-pill">
              <span className="summary-value">{totalResponses}</span>
              <span className="summary-label">Responses</span>
            </div>
          </div>
        </header>

        <div className="workspace-grid">
          <div className="workspace-column">
            <section className="panel" ref={builderRef}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    {editingSurveyId ? "Edit survey" : "Create survey"}
                  </h2>
                  <p className="panel-description">
                    {editingSurveyId
                      ? "Update the brand or questions, then save your changes."
                      : "Set the brand, write your questions, then publish."}
                  </p>
                </div>
                <span className="question-type-badge">{editingSurveyId ? "Editing" : "Draft"}</span>
              </div>
              <div className="panel-body">
                <form className="builder-form" onSubmit={handleSaveSurvey}>
                  <div className="settings-grid">
                    <div className="field field-wide">
                      <label className="label" htmlFor="survey-title">
                        Survey title
                      </label>
                      <input
                        className="input"
                        id="survey-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="e.g. Q3 customer experience"
                        required
                      />
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="logo-url">
                        Logo URL <span className="field-hint">(optional)</span>
                      </label>
                      <input
                        className="input"
                        id="logo-url"
                        type="url"
                        value={logoUrl}
                        onChange={(event) => setLogoUrl(event.target.value)}
                        placeholder="https://company.com/logo.svg"
                      />
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="brand-color">
                        Brand color
                      </label>
                      <div className="color-field">
                        <input
                          className="color-input"
                          id="brand-color"
                          type="color"
                          value={primaryColor}
                          onChange={(event) => setPrimaryColor(event.target.value)}
                          aria-label="Choose brand color"
                        />
                        <span className="color-value">{primaryColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="section-heading-row">
                      <div>
                        <h3 className="section-label">Questions</h3>
                        <p className="panel-description">{questions.length} in this survey</p>
                      </div>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={addQuestion}
                      >
                        <span aria-hidden="true">+</span> Add question
                      </button>
                    </div>

                    <div className="question-list">
                      {questions.map((question, index) => (
                        <article className="question-card" key={question.id}>
                          <div className="question-card-header">
                            <div className="question-identity">
                              <span className="drag-handle" aria-hidden="true">
                                :::
                              </span>
                              <span className="question-number">Question {index + 1}</span>
                              <span className="question-type-badge">
                                {questionTypeLabels[question.type]}
                              </span>
                            </div>
                            <div className="question-actions">
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => moveQuestion(index, -1)}
                                disabled={index === 0}
                                aria-label={`Move question ${index + 1} up`}
                              >
                                &uarr;
                              </button>
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => moveQuestion(index, 1)}
                                disabled={index === questions.length - 1}
                                aria-label={`Move question ${index + 1} down`}
                              >
                                &darr;
                              </button>
                              <button
                                className="button button-quiet button-danger"
                                type="button"
                                onClick={() => removeQuestion(index)}
                                disabled={questions.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="question-card-body">
                            <div className="question-config-row">
                              <div className="field">
                                <label className="label" htmlFor={`prompt-${question.id}`}>
                                  Prompt
                                </label>
                                <textarea
                                  className="textarea"
                                  id={`prompt-${question.id}`}
                                  value={question.prompt}
                                  onChange={(event) =>
                                    updateQuestion(index, { prompt: event.target.value })
                                  }
                                  placeholder="What would you like to ask?"
                                />
                              </div>
                              <div className="field">
                                <label className="label" htmlFor={`type-${question.id}`}>
                                  Answer type
                                </label>
                                <select
                                  className="select"
                                  id={`type-${question.id}`}
                                  value={question.type}
                                  onChange={(event) =>
                                    updateQuestion(index, {
                                      type: event.target.value as QuestionForm["type"],
                                      options:
                                        event.target.value === "multiple_choice"
                                          ? question.options.length >= 2
                                            ? question.options
                                            : ["", ""]
                                          : question.options,
                                    })
                                  }
                                >
                                  <option value="short_text">Written answer</option>
                                  <option value="multiple_choice">Multiple choice</option>
                                  <option value="rating">Rating (1-5)</option>
                                </select>
                              </div>
                            </div>

                            {question.type === "multiple_choice" && (
                              <div className="field">
                                <span className="label">Answer options</span>
                                <div className="option-list">
                                  {question.options.map((option, optionIndex) => (
                                    <div
                                      className="option-row"
                                      key={`${question.id}-${optionIndex}`}
                                    >
                                      <span className="option-marker" aria-hidden="true" />
                                      <input
                                        className="input"
                                        value={option}
                                        onChange={(event) =>
                                          updateOption(index, optionIndex, event.target.value)
                                        }
                                        placeholder={`Option ${optionIndex + 1}`}
                                        aria-label={`Option ${optionIndex + 1}`}
                                      />
                                      <button
                                        className="icon-button"
                                        type="button"
                                        onClick={() => removeOption(index, optionIndex)}
                                        disabled={question.options.length <= 2}
                                        aria-label={`Remove option ${optionIndex + 1}`}
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div>
                                  <button
                                    className="button button-quiet"
                                    type="button"
                                    onClick={() => addOption(index)}
                                  >
                                    + Add option
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="builder-footer">
                    <div aria-live="polite">
                      {builderError && (
                        <p className="status-message status-error" role="alert">
                          {builderError}
                        </p>
                      )}
                      {successMessage && (
                        <p className="status-message status-success">{successMessage}</p>
                      )}
                      {!builderError && !successMessage && (
                        <p className="field-hint">
                          Your survey will be public as soon as it is created.
                        </p>
                      )}
                    </div>
                    <div className="survey-actions">
                      {editingSurveyId && (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={resetBuilder}
                        >
                          Cancel
                        </button>
                      )}
                      <button className="button button-primary" type="submit" disabled={saving}>
                        {saving
                          ? editingSurveyId
                            ? "Saving..."
                            : "Publishing..."
                          : editingSurveyId
                            ? "Save changes"
                            : "Create survey"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </div>

          <div className="workspace-column workspace-column-secondary">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Your surveys</h2>
                  <p className="panel-description">Open a survey or review its latest responses.</p>
                </div>
              </div>

              {loadingSurveys ? (
                <div className="loading-block">Loading surveys...</div>
              ) : surveys.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    +
                  </div>
                  <h3 className="empty-title">No surveys yet</h3>
                  <p className="empty-description">
                    Your first survey will appear here with its share link and response count.
                  </p>
                </div>
              ) : (
                <div className="survey-list">
                  {surveys.map((survey) => {
                    const surveyStyle = {
                      "--survey-color": survey.primary_color,
                      "--survey-contrast": getContrastColor(survey.primary_color),
                    } as React.CSSProperties;
                    return (
                      <article
                        className={`survey-card ${
                          survey.id === selectedSurveyId ? "survey-card-active" : ""
                        }`}
                        key={survey.id}
                        style={surveyStyle}
                      >
                        <div className="survey-card-top">
                          <div className="survey-brand">
                            <div className="brand-preview">
                              {survey.logo_url ? (
                                <img src={survey.logo_url} alt="" />
                              ) : (
                                survey.title.slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h3 className="survey-title">{survey.title}</h3>
                              <p className="survey-date">Created {formatDate(survey.created_at)}</p>
                            </div>
                          </div>
                          <span className="response-count">
                            {survey.response_count}{" "}
                            {survey.response_count === 1 ? "response" : "responses"}
                          </span>
                        </div>
                        <div className="survey-url">
                          <span aria-hidden="true">/</span>
                          <span className="survey-url-text">{`survey/${survey.slug}`}</span>
                        </div>
                        <div className="survey-actions">
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => viewResponses(survey.id)}
                          >
                            View responses
                          </button>
                          <button
                            className="button button-quiet"
                            type="button"
                            onClick={() => void copySurveyLink(survey)}
                          >
                            {copiedSurveyId === survey.id ? "Link copied" : "Copy link"}
                          </button>
                          <button
                            className="button button-quiet"
                            type="button"
                            onClick={() => void editSurvey(survey)}
                            disabled={loadingEditor}
                          >
                            Edit survey
                          </button>
                          <a
                            className="button button-quiet"
                            href={`/survey/${survey.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open survey
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel" ref={responsesRef}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    {selectedSurvey ? selectedSurvey.title : "Responses"}
                  </h2>
                  <p className="panel-description">
                    {selectedSurvey
                      ? "Individual submissions, newest first."
                      : "Select a survey to review."}
                  </p>
                </div>
                {selectedSurvey && (
                  <span className="responses-header-meta">
                    {selectedSurvey.response_count} total
                  </span>
                )}
              </div>

              {!selectedSurvey ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    =
                  </div>
                  <h3 className="empty-title">Choose a survey</h3>
                  <p className="empty-description">
                    Select View responses above to inspect its submissions.
                  </p>
                </div>
              ) : loadingResponses ? (
                <div className="loading-block">Loading responses...</div>
              ) : responses.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    0
                  </div>
                  <h3 className="empty-title">Waiting for the first response</h3>
                  <p className="empty-description">
                    Share the public link. New submissions will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="panel-body">
                  <div className="response-list">
                    {responses.map((response, responseIndex) => (
                      <article className="response-card" key={response.id}>
                        <header className="response-header">
                          <h3 className="response-label">
                            Submission {responses.length - responseIndex}
                          </h3>
                          <time className="response-time" dateTime={response.created_at}>
                            {formatDateTime(response.created_at)}
                          </time>
                        </header>
                        <dl className="answer-list">
                          {response.answers.map((answer, answerIndex) => (
                            <div className="answer-group" key={`${response.id}-${answerIndex}`}>
                              <dt>{answer.prompt}</dt>
                              <dd>{answer.value || "No answer provided"}</dd>
                            </div>
                          ))}
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
