create table public.league_settings (
  id int primary key default 1 check (id = 1),
  transfer_window_open boolean not null default true,
  training_cost_per_point bigint not null default 500000
);
insert into public.league_settings (id) values (1);
grant select, update on public.league_settings to authenticated;
grant all on public.league_settings to service_role;
alter table public.league_settings enable row level security;
create policy "settings read" on public.league_settings for select to authenticated using (true);
create policy "settings admin update" on public.league_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.players add column if not exists loan_from_team_id uuid references public.teams(id) on delete set null;
alter table public.players add column if not exists loan_until_round int;
alter table public.transfer_offers add column if not exists kind text not null default 'transfer';
alter table public.transfer_offers add column if not exists loan_rounds int;

create or replace function public.window_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (select transfer_window_open from public.league_settings where id=1) then raise exception 'חלון ההעברות סגור'; end if;
  if exists(select 1 from public.players where id=new.player_id and loan_from_team_id is not null) then raise exception 'השחקן נמצא בהשאלה'; end if;
  return new;
end $$;
create trigger offers_window_guard before insert on public.transfer_offers for each row execute function public.window_guard();

create or replace function public.accept_offer(_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.transfer_offers; b bigint; cur int;
begin
  if not (select transfer_window_open from public.league_settings where id=1) then raise exception 'חלון ההעברות סגור'; end if;
  select * into o from public.transfer_offers where id=_offer_id for update;
  if o.status <> 'pending' then raise exception 'ההצעה אינה פעילה'; end if;
  if o.seller_team_id is distinct from public.my_team_id() then raise exception 'רק המוכר יכול לאשר'; end if;
  if not exists(select 1 from public.players where id=o.player_id and team_id=o.seller_team_id and loan_from_team_id is null) then raise exception 'השחקן לא זמין'; end if;
  select budget into b from public.teams where id=o.buyer_team_id for update;
  if b < o.amount then raise exception 'לקונה אין מספיק תקציב'; end if;
  update public.teams set budget = budget - o.amount where id=o.buyer_team_id;
  update public.teams set budget = budget + o.amount,
    lineup = coalesce((select jsonb_object_agg(key,value) from jsonb_each_text(lineup) where value <> o.player_id::text), '{}'::jsonb),
    bench = coalesce((select jsonb_agg(v) from jsonb_array_elements_text(bench) v where v <> o.player_id::text), '[]'::jsonb)
    where id=o.seller_team_id;
  if o.kind = 'loan' then
    select coalesce(max(number),0) into cur from public.rounds where status in ('active','completed');
    update public.players set team_id=o.buyer_team_id, loan_from_team_id=o.seller_team_id,
      loan_until_round = cur + greatest(coalesce(o.loan_rounds,1),1), transfer_listed=false, asking_price=0 where id=o.player_id;
  else
    update public.players set team_id=o.buyer_team_id, transfer_listed=false, asking_price=0 where id=o.player_id;
  end if;
  update public.transfer_offers set status='accepted' where id=_offer_id;
  update public.transfer_offers set status='cancelled' where player_id=o.player_id and status='pending' and id<>_offer_id;
end $$;

create or replace function public.train_player(_player_id uuid, _points int)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid := public.my_team_id(); c bigint; r int;
begin
  if _points < 1 or _points > 10 then raise exception 'כמות לא חוקית'; end if;
  select rating into r from public.players where id=_player_id and team_id=t for update;
  if r is null then raise exception 'השחקן לא בקבוצה שלך'; end if;
  if r + _points > 99 then raise exception 'רייטינג מקסימלי 99'; end if;
  select training_cost_per_point * _points into c from public.league_settings where id=1;
  if (select budget from public.teams where id=t) < c then raise exception 'אין מספיק תקציב'; end if;
  update public.teams set budget = budget - c where id=t;
  update public.players set rating = rating + _points where id=_player_id;
end $$;
grant execute on function public.train_player(uuid,int), public.accept_offer(uuid) to authenticated;