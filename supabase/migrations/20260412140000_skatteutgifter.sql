-- Skatteutgifter (tax expenditures) data layer
-- See .planning/skatteutgifter-research.md for source documentation.
--
-- These are NOT anslag. They live on the revenue side of the budget under
-- inkomsttitel 1700-serien and are reported annually in regeringens
-- skatteutgiftsbilaga to budgetpropositionen.

create table if not exists public.dim_skatteutgift (
  skatteutgift_id   int primary key,
  code              text not null unique,
  name_sv           text not null,
  name_en           text,
  description_sv    text,
  description_en    text,
  thematic_area_id  int references public.dim_area(area_id),
  sort_order        int not null default 0
);

create table if not exists public.fact_skatteutgift (
  fact_id         bigserial primary key,
  year_id         int not null references public.dim_year(year_id),
  skatteutgift_id int not null references public.dim_skatteutgift(skatteutgift_id),
  amount_mkr      numeric(14, 2) not null,
  is_estimated    boolean not null default false
);

create index if not exists idx_fact_skatteutgift_year
  on public.fact_skatteutgift(year_id, skatteutgift_id);

alter table public.dim_skatteutgift enable row level security;
alter table public.fact_skatteutgift enable row level security;

drop policy if exists "public read dim_skatteutgift" on public.dim_skatteutgift;
create policy "public read dim_skatteutgift"
  on public.dim_skatteutgift for select using (true);

drop policy if exists "public read fact_skatteutgift" on public.fact_skatteutgift;
create policy "public read fact_skatteutgift"
  on public.fact_skatteutgift for select using (true);
