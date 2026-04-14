create table if not exists public.dim_public_function (
  public_function_id int primary key,
  code               text not null unique,
  name_sv            text not null,
  name_en            text,
  sort_order         int not null
);

create table if not exists public.fact_public_budget (
  fact_public_budget_id bigserial primary key,
  year_id               int not null references public.dim_year(year_id),
  public_function_id    int not null references public.dim_public_function(public_function_id),
  amount_mkr            bigint not null
);

create unique index if not exists idx_fact_public_budget_year_function
  on public.fact_public_budget(year_id, public_function_id);

create index if not exists idx_fact_public_budget_function_ts
  on public.fact_public_budget(public_function_id, year_id);

alter table public.dim_public_function enable row level security;
alter table public.fact_public_budget enable row level security;

drop policy if exists "public read dim_public_function" on public.dim_public_function;
create policy "public read dim_public_function"
  on public.dim_public_function for select using (true);

drop policy if exists "public read fact_public_budget" on public.fact_public_budget;
create policy "public read fact_public_budget"
  on public.fact_public_budget for select using (true);
