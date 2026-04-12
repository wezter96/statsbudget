// Supabase Edge Function: POST /functions/v1/submit-issue
//
// Receives a feedback form payload from Statsbudget and creates a public
// GitHub issue via the REST API. Spam-resistant via honeypot + length caps.
//
// Required secrets (set via `supabase secrets set`):
//   GITHUB_TOKEN  — fine-grained PAT with Issues: read+write on the repo
//   GITHUB_REPO   — "owner/repo" target, e.g. "wezter96/statsbudget-feedback"

type Payload = {
  category?: string;
  title?: string;
  description?: string;
  contactEmail?: string;
  sourceUrl?: string;
  /** Honeypot — must be empty. */
  website?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  wrong_number: 'Felaktig siffra',
  missing_source: 'Saknad källa',
  bug: 'Bugg',
  suggestion: 'Förslag',
  other: 'Annat',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const token = Deno.env.get('GITHUB_TOKEN');
  const repo = Deno.env.get('GITHUB_REPO');
  if (!token || !repo) {
    return json(500, { error: 'server_not_configured' });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  // Honeypot — real users leave this empty
  if (payload.website && payload.website.trim().length > 0) {
    return json(200, { ok: true, skipped: 'honeypot' });
  }

  const category = (payload.category ?? '').trim();
  const title = (payload.title ?? '').trim();
  const description = (payload.description ?? '').trim();
  const contactEmail = (payload.contactEmail ?? '').trim();
  const sourceUrl = (payload.sourceUrl ?? '').trim();

  if (!title || title.length > 120) return json(400, { error: 'title_length' });
  if (!description || description.length > 4000) return json(400, { error: 'description_length' });
  if (contactEmail.length > 0 && contactEmail.length > 200) return json(400, { error: 'email_length' });
  if (sourceUrl.length > 500) return json(400, { error: 'url_length' });
  if (!CATEGORY_LABELS[category]) return json(400, { error: 'invalid_category' });

  const categoryLabel = CATEGORY_LABELS[category];
  const issueTitle = `[${categoryLabel}] ${title}`;
  const issueBody = [
    `**Kategori:** ${categoryLabel}`,
    sourceUrl ? `**Sida:** ${sourceUrl}` : null,
    contactEmail ? `**Kontakt:** ${contactEmail}` : null,
    '',
    '---',
    '',
    description,
    '',
    '---',
    '_Rapporterad via feedbackformuläret på Statsbudget_',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'statsbudget-feedback',
    },
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody,
      labels: ['feedback', `type:${category}`],
    }),
  });

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    console.error('github_api_error', ghRes.status, errText);
    return json(502, { error: 'github_api_error', status: ghRes.status });
  }

  const issue = await ghRes.json();
  return json(200, {
    ok: true,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  });
});
