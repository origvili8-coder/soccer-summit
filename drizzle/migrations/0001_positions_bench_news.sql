alter table public.players add column if not exists detailed_position text not null default 'CM';
update public.players set detailed_position = case position when 'GK' then 'GK' when 'DEF' then 'CB' when 'MID' then 'CM' else 'ST' end;
alter table public.teams add column if not exists bench jsonb not null default '[]'::jsonb;

create table public.news (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'general',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.news to authenticated;
grant all on public.news to service_role;
alter table public.news enable row level security;
create policy "news read" on public.news for select to authenticated using (true);
create policy "news admin write" on public.news for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
alter publication supabase_realtime add table public.news;

create or replace function public.save_lineup_v2(_formation text, _lineup jsonb, _bench jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid := public.my_team_id();
begin
  if t is null then raise exception 'No team assigned'; end if;
  if jsonb_array_length(_bench) > 5 then raise exception 'עד 5 שחקני ספסל'; end if;
  if exists (select 1 from jsonb_each_text(_lineup) e join public.players p on p.id = e.value::uuid where p.team_id is distinct from t or p.suspended_matches > 0)
     or exists (select 1 from jsonb_array_elements_text(_bench) b join public.players p on p.id = b::uuid where p.team_id is distinct from t or p.suspended_matches > 0) then
    raise exception 'הרכב לא תקין: שחקן מושעה או לא שייך לקבוצה';
  end if;
  update public.teams set formation=_formation, lineup=_lineup, bench=_bench where id=t;
end $$;
grant execute on function public.save_lineup_v2(text,jsonb,jsonb) to authenticated;