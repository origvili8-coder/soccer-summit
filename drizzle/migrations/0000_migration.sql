create type public.app_role as enum ('admin','manager');
create type public.player_position as enum ('GK','DEF','MID','FWD');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  logo_url text,
  color text not null default '#22c55e',
  budget bigint not null default 10000000,
  formation text not null default '4-3-3',
  lineup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
create policy "teams read" on public.teams for select to authenticated using (true);
create policy "teams admin write" on public.teams for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key,
  username text not null unique,
  display_name text not null default '',
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles admin write" on public.profiles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.my_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  position player_position not null,
  avatar_url text,
  rating int not null default 70,
  goals int not null default 0,
  assists int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  suspended_matches int not null default 0,
  transfer_listed boolean not null default false,
  asking_price bigint not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.players to authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "players read" on public.players for select to authenticated using (true);
create policy "players admin write" on public.players for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  status text not null default 'pending' check (status in ('pending','active','completed')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rounds to authenticated;
grant all on public.rounds to service_role;
alter table public.rounds enable row level security;
create policy "rounds read" on public.rounds for select to authenticated using (true);
create policy "rounds admin write" on public.rounds for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled','finished')),
  home_ready boolean not null default false,
  away_ready boolean not null default false,
  home_score int not null default 0,
  away_score int not null default 0,
  started_at timestamptz,
  events jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "matches read" on public.matches for select to authenticated using (true);
create policy "matches admin write" on public.matches for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.transfer_offers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  buyer_team_id uuid not null references public.teams(id) on delete cascade,
  seller_team_id uuid not null references public.teams(id) on delete cascade,
  amount bigint not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.transfer_offers to authenticated;
grant all on public.transfer_offers to service_role;
alter table public.transfer_offers enable row level security;
create policy "offers read involved" on public.transfer_offers for select to authenticated using (buyer_team_id = public.my_team_id() or seller_team_id = public.my_team_id() or public.has_role(auth.uid(),'admin'));
create policy "offers create as buyer" on public.transfer_offers for insert to authenticated with check (buyer_team_id = public.my_team_id() and created_by = auth.uid() and status='pending' and buyer_team_id <> seller_team_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid(),
  recipient_id uuid not null,
  body text not null default '',
  offer_id uuid references public.transfer_offers(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages read own" on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages send" on public.messages for insert to authenticated with check (sender_id = auth.uid());

create or replace function public.save_lineup(_formation text, _lineup jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid := public.my_team_id();
begin
  if t is null then raise exception 'No team assigned'; end if;
  if exists (select 1 from jsonb_each_text(_lineup) e join public.players p on p.id = e.value::uuid where p.team_id is distinct from t or p.suspended_matches > 0) then
    raise exception 'הרכב לא תקין: שחקן מושעה או לא שייך לקבוצה';
  end if;
  update public.teams set formation=_formation, lineup=_lineup where id=t;
end $$;

create or replace function public.set_transfer_listing(_player_id uuid, _listed boolean, _price bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.players set transfer_listed=_listed, asking_price=greatest(_price,0)
  where id=_player_id and team_id = public.my_team_id();
  if not found then raise exception 'Not your player'; end if;
end $$;

create or replace function public.cancel_or_reject_offer(_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.transfer_offers;
begin
  select * into o from public.transfer_offers where id=_offer_id for update;
  if o.status <> 'pending' then raise exception 'ההצעה אינה פעילה'; end if;
  if o.seller_team_id = public.my_team_id() then update public.transfer_offers set status='rejected' where id=_offer_id;
  elsif o.buyer_team_id = public.my_team_id() then update public.transfer_offers set status='cancelled' where id=_offer_id;
  else raise exception 'Not allowed'; end if;
end $$;

create or replace function public.accept_offer(_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.transfer_offers; b bigint;
begin
  select * into o from public.transfer_offers where id=_offer_id for update;
  if o.status <> 'pending' then raise exception 'ההצעה אינה פעילה'; end if;
  if o.seller_team_id is distinct from public.my_team_id() then raise exception 'רק המוכר יכול לאשר'; end if;
  if not exists(select 1 from public.players where id=o.player_id and team_id=o.seller_team_id) then raise exception 'השחקן כבר לא בקבוצה'; end if;
  select budget into b from public.teams where id=o.buyer_team_id for update;
  if b < o.amount then raise exception 'לקונה אין מספיק תקציב'; end if;
  update public.teams set budget = budget - o.amount where id=o.buyer_team_id;
  update public.teams set budget = budget + o.amount,
    lineup = coalesce((select jsonb_object_agg(key,value) from jsonb_each_text(lineup) where value <> o.player_id::text), '{}'::jsonb)
    where id=o.seller_team_id;
  update public.players set team_id=o.buyer_team_id, transfer_listed=false, asking_price=0 where id=o.player_id;
  update public.transfer_offers set status='accepted' where id=_offer_id;
  update public.transfer_offers set status='cancelled' where player_id=o.player_id and status='pending' and id<>_offer_id;
end $$;

grant execute on function public.save_lineup(text,jsonb), public.set_transfer_listing(uuid,boolean,bigint), public.cancel_or_reject_offer(uuid), public.accept_offer(uuid), public.my_team_id(), public.has_role(uuid,app_role) to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.transfer_offers;