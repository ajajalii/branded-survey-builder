import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Env, QuestionRow, ResponseRow, SurveyRow } from "../types";

const survey = new Hono<Env>();

type CreateSurveyBody = {
  title: string;
  primary_color: string;
  logo_url?: string;
  questions: Array<{
    id: string;
    type: "short_text" | "multiple_choice" | "rating";
    prompt: string;
    options?: string[];
  }>;
};

type PublicSurveyResponse = {
  id: string;
  slug: string;
  title: string;
  primary_color: string;
  logo_url: string | null;
  created_at: string;
  questions: Array<{
    id: string;
    question_order: number;
    type: string;
    prompt: string;
    options: string[] | null;
  }>;
};

type SurveyResponseListItem = {
  id: string;
  created_at: string;
  answers: Array<{ prompt: string; value: string }>;
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

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

survey.post("/", authMiddleware, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("title" in body) ||
    !("primary_color" in body) ||
    !("questions" in body) ||
    typeof (body as Record<string, unknown>).title !== "string" ||
    typeof (body as Record<string, unknown>).primary_color !== "string" ||
    !Array.isArray((body as Record<string, unknown>).questions)
  ) {
    return c.json({ error: "Invalid survey payload" }, 400);
  }

  const { title, primary_color, logo_url, questions } = body as CreateSurveyBody;
  if (!title.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }
  if (!/^#([0-9a-fA-F]{6})$/.test(primary_color)) {
    return c.json({ error: "Primary color must be a valid hex color" }, 400);
  }
  if (logo_url && typeof logo_url !== "string") {
    return c.json({ error: "logo_url must be a string" }, 400);
  }

  if (questions.length === 0) {
    return c.json({ error: "At least one question is required" }, 400);
  }

  const validTypes = ["short_text", "multiple_choice", "rating"] as const;
  for (const [index, question] of questions.entries()) {
    if (!question || typeof question !== "object") {
      return c.json({ error: `Invalid question at index ${index}` }, 400);
    }
    if (typeof question.id !== "string" || !question.id.trim()) {
      return c.json({ error: `Question ${index + 1} must have an id` }, 400);
    }
    if (!validTypes.includes(question.type)) {
      return c.json({ error: `Question ${index + 1} has an invalid type` }, 400);
    }
    if (typeof question.prompt !== "string" || !question.prompt.trim()) {
      return c.json({ error: `Question ${index + 1} must have a prompt` }, 400);
    }
    if (question.type === "multiple_choice") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        return c.json(
          { error: `Multiple choice question ${index + 1} requires at least 2 options` },
          400
        );
      }
      if (question.options.some((option) => typeof option !== "string" || !option.trim())) {
        return c.json({ error: `Multiple choice question ${index + 1} has invalid options` }, 400);
      }
    }
  }

  const surveyId = crypto.randomUUID();
  const baseSlug = slugify(title) || "survey";
  const slug = `${baseSlug}-${surveyId.slice(0, 8)}`;

  await c.env.DB.prepare(
    "INSERT INTO surveys (id, owner_id, slug, title, primary_color, logo_url) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(surveyId, c.get("userId"), slug, title.trim(), primary_color, logo_url?.trim() ?? null)
    .run();

  for (const [index, question] of questions.entries()) {
    await c.env.DB.prepare(
      "INSERT INTO questions (id, survey_id, question_order, type, prompt, options) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        question.id,
        surveyId,
        index,
        question.type,
        question.prompt.trim(),
        question.type === "multiple_choice" ? JSON.stringify(question.options) : null
      )
      .run();
  }

  return c.json({ id: surveyId, slug });
});

survey.get("/", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
      id,
      title,
      slug,
      primary_color,
      logo_url,
      created_at,
      COALESCE((SELECT COUNT(*) FROM responses WHERE survey_id = surveys.id), 0) AS response_count
    FROM surveys
    WHERE owner_id = ?
    ORDER BY created_at DESC`
  )
    .bind(c.get("userId"))
    .all<SurveyListItem>();

  return c.json({ surveys: result.results ?? [] });
});

survey.get("/by-id/:surveyId/responses", authMiddleware, async (c) => {
  const surveyId = c.req.param("surveyId");
  const survey = await c.env.DB.prepare("SELECT id, owner_id FROM surveys WHERE id = ?")
    .bind(surveyId)
    .first<Pick<SurveyRow, "id" | "owner_id">>();

  if (!survey || survey.owner_id !== c.get("userId")) {
    return c.json({ error: "Survey not found" }, 404);
  }

  const questionsResult = await c.env.DB.prepare(
    "SELECT id, prompt FROM questions WHERE survey_id = ?"
  )
    .bind(surveyId)
    .all<{ id: string; prompt: string }>();
  const questions = new Map((questionsResult.results ?? []).map((q) => [q.id, q.prompt]));

  const responsesResult = await c.env.DB.prepare(
    "SELECT id, answers, created_at FROM responses WHERE survey_id = ? ORDER BY created_at DESC"
  )
    .bind(surveyId)
    .all<ResponseRow>();

  const responses: SurveyResponseListItem[] = (responsesResult.results ?? []).map((row) => {
    let answers: Array<{ prompt: string; value: string }> = [];
    try {
      const parsed = JSON.parse(row.answers) as Array<{ questionId: string; value: string }>;
      answers = parsed.map((answer) => ({
        prompt: questions.get(answer.questionId) ?? "Unknown question",
        value: answer.value,
      }));
    } catch {
      answers = [{ prompt: "Response data invalid", value: "" }];
    }
    return {
      id: row.id,
      created_at: row.created_at,
      answers,
    };
  });

  return c.json({ responses });
});

survey.put("/by-id/:surveyId", authMiddleware, async (c) => {
  const surveyId = c.req.param("surveyId");
  const existingSurvey = await c.env.DB.prepare("SELECT id, owner_id FROM surveys WHERE id = ?")
    .bind(surveyId)
    .first<Pick<SurveyRow, "id" | "owner_id">>();

  if (!existingSurvey || existingSurvey.owner_id !== c.get("userId")) {
    return c.json({ error: "Survey not found" }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("title" in body) ||
    !("primary_color" in body) ||
    !("questions" in body) ||
    typeof (body as Record<string, unknown>).title !== "string" ||
    typeof (body as Record<string, unknown>).primary_color !== "string" ||
    !Array.isArray((body as Record<string, unknown>).questions)
  ) {
    return c.json({ error: "Invalid survey payload" }, 400);
  }

  const { title, primary_color, logo_url, questions } = body as CreateSurveyBody;
  if (!title.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }
  if (!/^#([0-9a-fA-F]{6})$/.test(primary_color)) {
    return c.json({ error: "Primary color must be a valid hex color" }, 400);
  }
  if (logo_url && typeof logo_url !== "string") {
    return c.json({ error: "logo_url must be a string" }, 400);
  }
  if (questions.length === 0) {
    return c.json({ error: "At least one question is required" }, 400);
  }

  const validTypes = ["short_text", "multiple_choice", "rating"] as const;
  for (const [index, question] of questions.entries()) {
    if (!question || typeof question !== "object") {
      return c.json({ error: `Invalid question at index ${index}` }, 400);
    }
    if (typeof question.id !== "string" || !question.id.trim()) {
      return c.json({ error: `Question ${index + 1} must have an id` }, 400);
    }
    if (!validTypes.includes(question.type)) {
      return c.json({ error: `Question ${index + 1} has an invalid type` }, 400);
    }
    if (typeof question.prompt !== "string" || !question.prompt.trim()) {
      return c.json({ error: `Question ${index + 1} must have a prompt` }, 400);
    }
    if (
      question.type === "multiple_choice" &&
      (!Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.some((option) => typeof option !== "string" || !option.trim()))
    ) {
      return c.json(
        { error: `Multiple choice question ${index + 1} requires at least 2 options` },
        400
      );
    }
  }

  const statements = [
    c.env.DB.prepare(
      "UPDATE surveys SET title = ?, primary_color = ?, logo_url = ? WHERE id = ? AND owner_id = ?"
    ).bind(title.trim(), primary_color, logo_url?.trim() || null, surveyId, c.get("userId")),
    c.env.DB.prepare("DELETE FROM questions WHERE survey_id = ?").bind(surveyId),
    ...questions.map((question, index) =>
      c.env.DB.prepare(
        "INSERT INTO questions (id, survey_id, question_order, type, prompt, options) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        question.id,
        surveyId,
        index,
        question.type,
        question.prompt.trim(),
        question.type === "multiple_choice" ? JSON.stringify(question.options) : null
      )
    ),
  ];

  await c.env.DB.batch(statements);
  return c.json({ id: surveyId });
});

survey.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const survey = await c.env.DB.prepare(
    "SELECT id, slug, title, primary_color, logo_url, created_at FROM surveys WHERE slug = ?"
  )
    .bind(slug)
    .first<SurveyRow>();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  const questionsResult = await c.env.DB.prepare(
    "SELECT id, question_order, type, prompt, options FROM questions WHERE survey_id = ? ORDER BY question_order ASC"
  )
    .bind(survey.id)
    .all<QuestionRow>();

  return c.json({
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    primary_color: survey.primary_color,
    logo_url: survey.logo_url,
    created_at: survey.created_at,
    questions: (questionsResult.results ?? []).map((question) => ({
      id: question.id,
      question_order: question.question_order,
      type: question.type,
      prompt: question.prompt,
      options: question.options ? JSON.parse(question.options) : null,
    })),
  } as PublicSurveyResponse);
});

survey.post("/:slug/response", async (c) => {
  const slug = c.req.param("slug");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("answers" in body) ||
    !Array.isArray((body as Record<string, unknown>).answers)
  ) {
    return c.json({ error: "Invalid response payload" }, 400);
  }

  const survey = await c.env.DB.prepare("SELECT id FROM surveys WHERE slug = ?")
    .bind(slug)
    .first<Pick<SurveyRow, "id">>();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  const answers = (body as { answers: unknown }).answers;

  if (!Array.isArray(answers)) {
    return c.json({ error: "Invalid answers array" }, 400);
  }

  const parsedAnswers: Array<{ questionId: string; value: string }> = [];
  for (const [index, answer] of answers.entries()) {
    if (
      typeof answer !== "object" ||
      answer === null ||
      typeof (answer as Record<string, unknown>).questionId !== "string" ||
      typeof (answer as Record<string, unknown>).value !== "string"
    ) {
      return c.json({ error: `Invalid answer at index ${index}` }, 400);
    }

    const answerRecord = answer as { questionId: string; value: string };
    parsedAnswers.push({
      questionId: answerRecord.questionId,
      value: answerRecord.value,
    });
  }

  await c.env.DB.prepare("INSERT INTO responses (id, survey_id, answers) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), survey.id, JSON.stringify(parsedAnswers))
    .run();

  return c.json({ message: "Response recorded" }, 201);
});

export default survey;
