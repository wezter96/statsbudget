-- Periodiska inkomster (monthly revenue outcomes from Statskontoret/ESV).

create table if not exists public.dim_income_outcome_title (
  income_outcome_title_id  serial primary key,
  parent_id                int references public.dim_income_outcome_title(income_outcome_title_id),
  code                     text not null unique,
  name_sv                  text not null,
  level_key                text not null check (
    level_key in ('income_type', 'income_main_group', 'income_title_group', 'income_title')
  ),
  sort_order               int not null default 0
);

create table if not exists public.fact_income_outcome_month (
  fact_income_outcome_month_id  bigserial primary key,
  year_id                       int not null references public.dim_year(year_id),
  month_id                      int not null check (month_id between 1 and 12),
  income_outcome_title_id       int not null references public.dim_income_outcome_title(income_outcome_title_id),
  amount_mkr                    numeric(14, 2) not null,
  source_year                   int not null,
  source_month                  int not null check (source_month between 1 and 12),
  source_status                 text not null,
  unique (year_id, month_id, income_outcome_title_id)
);

create index if not exists idx_fact_income_outcome_month_period
  on public.fact_income_outcome_month(year_id, month_id, income_outcome_title_id);

create or replace view public.v_income_outcome_quarterly as
select
  year_id,
  ((month_id - 1) / 3 + 1)::int as quarter_id,
  income_outcome_title_id,
  sum(amount_mkr)::numeric(14, 2) as amount_mkr,
  max(source_year) as source_year,
  max(source_month) as source_month,
  max(source_status) as source_status
from public.fact_income_outcome_month
group by year_id, ((month_id - 1) / 3 + 1)::int, income_outcome_title_id;

alter table public.dim_income_outcome_title enable row level security;
alter table public.fact_income_outcome_month enable row level security;

drop policy if exists "public read dim_income_outcome_title" on public.dim_income_outcome_title;
create policy "public read dim_income_outcome_title"
  on public.dim_income_outcome_title for select using (true);

drop policy if exists "public read fact_income_outcome_month" on public.fact_income_outcome_month;
create policy "public read fact_income_outcome_month"
  on public.fact_income_outcome_month for select using (true);
