alter table public.matches alter column round_id drop not null;
alter table public.matches add column if not exists is_friendly boolean not null default false;
alter table public.matches add column if not exists home_xi jsonb not null default '[]'::jsonb;
alter table public.matches add column if not exists away_xi jsonb not null default '[]'::jsonb;
alter table public.matches add column if not exists home_formation text not null default '4-3-3';
alter table public.matches add column if not exists away_formation text not null default '4-3-3';
alter table public.matches add column if not exists subs jsonb not null default '[]'::jsonb;
alter table public.messages add column if not exists match_id uuid references public.matches(id) on delete set null;

create or replace function public.news_on_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
declare pn text; bn text; sn text;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select name into pn from public.players where id = new.player_id;
    select name into bn from public.teams where id = new.buyer_team_id;
    select name into sn from public.teams where id = new.seller_team_id;
    insert into public.news (kind, title, body) values ('transfer',
      'רשמי: ' || coalesce(pn,'שחקן') || ' עובר ל' || coalesce(bn,''),
      coalesce(sn,'') || ' ו' || coalesce(bn,'') || ' סגרו את העסקה תמורת ₪' || to_char(new.amount, 'FM999,999,999') || '. ' || coalesce(pn,'') || ' כבר מתאמן עם הקבוצה החדשה.');
  end if;
  return new;
end $$;
revoke execute on function public.news_on_transfer() from public, anon, authenticated;
drop trigger if exists trg_news_on_transfer on public.transfer_offers;
create trigger trg_news_on_transfer after update on public.transfer_offers for each row execute function public.news_on_transfer();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='news') then
    alter publication supabase_realtime add table public.news;
  end if;
end $$;