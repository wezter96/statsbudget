-- Skatteintakter (tax revenues) data layer.
-- Hierarchical income titles: top-level groups (parent_id IS NULL)
-- and subtitles (parent_id references a group).

create table if not exists public.dim_income_title (
  income_title_id  serial primary key,
  parent_id        int references public.dim_income_title(income_title_id),
  code             text not null unique,
  name_sv          text not null,
  name_en          text,
  description_sv   text,
  sort_order       int not null default 0
);

create table if not exists public.fact_income (
  fact_id          bigserial primary key,
  year_id          int not null references public.dim_year(year_id),
  income_title_id  int not null references public.dim_income_title(income_title_id),
  amount_mkr       numeric(14, 2) not null,
  is_estimated     boolean not null default false
);

create index if not exists idx_fact_income_year
  on public.fact_income(year_id, income_title_id);

alter table public.dim_income_title enable row level security;
alter table public.fact_income enable row level security;

drop policy if exists "public read dim_income_title" on public.dim_income_title;
create policy "public read dim_income_title"
  on public.dim_income_title for select using (true);

drop policy if exists "public read fact_income" on public.fact_income;
create policy "public read fact_income"
  on public.fact_income for select using (true);
