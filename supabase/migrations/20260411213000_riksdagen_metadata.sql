alter table public.dim_year add column if not exists riksdagen_proposition_url text;
alter table public.dim_year add column if not exists riksdagen_proposition_title text;
alter table public.dim_year add column if not exists riksdagen_decision_url text;
alter table public.dim_year add column if not exists riksdagen_decision_title text;
