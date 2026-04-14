-- Statsbudget star schema
-- Source units: ESV utfall (Mkr), SCB CPI (1980=100), SCB BNP (Mkr löpande priser)
-- All monetary columns store Mkr (millions SEK). Display layer converts as needed.

create table if not exists public.dim_year (
  year_id         int primary key,
  cpi_index       numeric,           -- KPI fastställda årsmedel (1980=100)
  gdp_nominal_sek bigint,             -- Mkr löpande priser
  is_historical   boolean not null default false
);

create table if not exists public.dim_area (
  area_id    int primary key,        -- = utgiftsområde 1..27
  code       text not null unique,   -- 'UO01'..'UO27'
  name_sv    text not null,
  name_en    text,
  sort_order int not null
);

create table if not exists public.dim_anslag (
  anslag_id bigint primary key,       -- use the 7-digit ESV anslag code
  area_id   int not null references public.dim_area(area_id),
  code      text not null,            -- e.g. '1:1'
  name_sv   text not null,
  name_en   text
);

create table if not exists public.dim_party (
  party_id  int primary key,
  code      text not null unique,     -- 'S','M','SD','C','V','KD','MP','L','ALLIANSEN','GOV'
  name_sv   text not null,
  color_hex text not null
);

create table if not exists public.fact_budget (
  fact_id            bigserial primary key,
  year_id            int not null references public.dim_year(year_id),
  area_id            int references public.dim_area(area_id),
  anslag_id          bigint references public.dim_anslag(anslag_id),
  party_id           int not null references public.dim_party(party_id),
  budget_type        text not null check (budget_type in ('actual','gov_proposed','shadow_delta')),
  amount_nominal_sek bigint not null,
  is_revenue         boolean not null default false
);

create index if not exists idx_fact_year       on public.fact_budget(year_id);
create index if not exists idx_fact_year_area  on public.fact_budget(year_id, area_id);
create index if not exists idx_fact_year_party on public.fact_budget(year_id, party_id);
create index if not exists idx_fact_area_ts    on public.fact_budget(area_id, year_id) where anslag_id is null and is_revenue = false;
create index if not exists idx_anslag_area     on public.dim_anslag(area_id);

-- Public read-only access (civic data, no auth)
alter table public.dim_year     enable row level security;
alter table public.dim_area     enable row level security;
alter table public.dim_anslag   enable row level security;
alter table public.dim_party    enable row level security;
alter table public.fact_budget  enable row level security;

drop policy if exists "public read dim_year" on public.dim_year;
create policy "public read dim_year"    on public.dim_year    for select using (true);
drop policy if exists "public read dim_area" on public.dim_area;
create policy "public read dim_area"    on public.dim_area    for select using (true);
drop policy if exists "public read dim_anslag" on public.dim_anslag;
create policy "public read dim_anslag"  on public.dim_anslag  for select using (true);
drop policy if exists "public read dim_party" on public.dim_party;
create policy "public read dim_party"   on public.dim_party   for select using (true);
drop policy if exists "public read fact_budget" on public.fact_budget;
create policy "public read fact_budget" on public.fact_budget for select using (true);

-- Seed: parties (static list)
insert into public.dim_party(party_id, code, name_sv, color_hex) values
  (1,'GOV',       'Regeringen',         '#1F1B16'),
  (2,'S',         'Socialdemokraterna', '#E8112D'),
  (3,'M',         'Moderaterna',        '#1B49BB'),
  (4,'SD',        'Sverigedemokraterna','#DDCC22'),
  (5,'C',         'Centerpartiet',      '#009933'),
  (6,'V',         'Vänsterpartiet',     '#AF0000'),
  (7,'KD',        'Kristdemokraterna',  '#005CA9'),
  (8,'MP',        'Miljöpartiet',       '#83CF39'),
  (9,'L',         'Liberalerna',        '#006AB3'),
  (10,'ALLIANSEN','Alliansen',          '#4B5EAA')
on conflict (party_id) do nothing;
