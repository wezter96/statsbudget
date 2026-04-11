-- Historical snapshots (1975/76, 1980/81, 1985/86) use huvudtitlar, not the
-- modern 27 utgiftsområden. Stored in a separate table so they don't
-- contaminate the 1997+ area/anslag axis.

alter table public.dim_year add column if not exists historical_context_sv  text;
alter table public.dim_year add column if not exists historical_source_url  text;
alter table public.dim_year add column if not exists historical_source_title text;
alter table public.dim_year add column if not exists historical_confidence  text;
alter table public.dim_year add column if not exists fiscal_year_label      text;

create table if not exists public.fact_historical (
  fact_id        bigserial primary key,
  year_id        int not null references public.dim_year(year_id),
  category_sv    text not null,
  sort_order     int not null,
  amount_mkr     numeric(14, 2) not null,
  is_uncertain   boolean not null default false
);

create index if not exists idx_fact_historical_year on public.fact_historical(year_id, sort_order);

alter table public.fact_historical enable row level security;
drop policy if exists "public read fact_historical" on public.fact_historical;
create policy "public read fact_historical" on public.fact_historical for select using (true);
