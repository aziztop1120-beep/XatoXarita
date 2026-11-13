-- XatoXarita AI — USTOZ PANELI (to'liq) migratsiyasi.
-- Tartib: schema.sql -> admin.sql -> teacher_panel.sql. SQL Editor'da to'liq ishga tushiring.
-- Qayta ishga tushirish xavfsiz (idempotent).

-- 1) Faollik ustunlari (kirish, onlayn holat)
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists login_count int not null default 0;
alter table public.profiles add column if not exists presence text not null default 'offline'
  check (presence in ('online', 'in_test', 'offline'));

-- 2) Test urinishiga qo'shimcha ma'lumot (davomiylik, javob vaqtlari, kuzatiladigan hodisalar)
alter table public.attempts add column if not exists started_at timestamptz;
alter table public.attempts add column if not exists duration_sec int;
alter table public.attempts add column if not exists session_id uuid;
alter table public.attempts add column if not exists timing jsonb;

-- 3) Test sessiyalari (boshlangan, davom etayotgan, tugatilgan, tashlab ketilgan)
create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null default 'all',
  grade int,
  total int not null check (total > 0),
  answered int not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  last_ping_at timestamptz not null default now(),
  finished_at timestamptz,
  attempt_id uuid references public.attempts(id) on delete set null
);

-- 4) Har bir savolga berilgan javob
create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  question_id text,
  subject text not null,
  topic text not null,
  question text not null,
  options jsonb not null default '[]',
  user_answer int,
  correct_answer int not null,
  is_correct boolean not null,
  time_spent_ms int,
  created_at timestamptz not null default now()
);

-- 5) Saytga kirishlar jurnali
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists attempts_created_idx on public.attempts (created_at desc);
create index if not exists sessions_user_idx on public.test_sessions (user_id, started_at desc);
create index if not exists answers_attempt_idx on public.attempt_answers (attempt_id, position);
create index if not exists answers_user_idx on public.attempt_answers (user_id);
create index if not exists logins_created_idx on public.login_events (created_at desc);
create index if not exists profiles_seen_idx on public.profiles (last_seen_at desc);

-- 6) Row Level Security
alter table public.test_sessions enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.login_events enable row level security;

drop policy if exists "sessions_select_own" on public.test_sessions;
drop policy if exists "sessions_insert_own" on public.test_sessions;
drop policy if exists "sessions_update_own" on public.test_sessions;
drop policy if exists "sessions_select_teacher" on public.test_sessions;
create policy "sessions_select_own" on public.test_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.test_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.test_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_select_teacher" on public.test_sessions for select using (public.is_teacher());

drop policy if exists "answers_select_own" on public.attempt_answers;
drop policy if exists "answers_insert_own" on public.attempt_answers;
drop policy if exists "answers_select_teacher" on public.attempt_answers;
create policy "answers_select_own" on public.attempt_answers for select using (auth.uid() = user_id);
create policy "answers_insert_own" on public.attempt_answers for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
);
create policy "answers_select_teacher" on public.attempt_answers for select using (public.is_teacher());

drop policy if exists "logins_select_own" on public.login_events;
drop policy if exists "logins_select_teacher" on public.login_events;
create policy "logins_select_own" on public.login_events for select using (auth.uid() = user_id);
create policy "logins_select_teacher" on public.login_events for select using (public.is_teacher());
-- login_events ga faqat record_login() funksiyasi yozadi (to'g'ridan-to'g'ri insert siyosati yo'q)

-- 7) Foydalanuvchi faollik maydonlarini qo'lda o'zgartira olmasin (faqat quyidagi funksiyalar orqali)
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.role := old.role;
    new.email := old.email;
    if coalesce(current_setting('xx.rpc', true), '') <> '1' then
      new.last_login_at := old.last_login_at;
      new.last_seen_at := old.last_seen_at;
      new.login_count := old.login_count;
      new.presence := old.presence;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_role on public.profiles;
create trigger protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 8) Heartbeat: o'quvchi saytda ekanini bildiradi (har ~30 soniyada)
create or replace function public.heartbeat(p_presence text default 'online', p_session uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('xx.rpc', '1', true);
  update public.profiles
     set last_seen_at = now(),
         presence = case when p_presence in ('online', 'in_test', 'offline') then p_presence else 'online' end
   where id = auth.uid();
  if p_session is not null then
    update public.test_sessions set last_ping_at = now()
     where id = p_session and user_id = auth.uid() and status = 'in_progress';
  end if;
end $$;

-- 9) Saytga kirish
create or replace function public.record_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform set_config('xx.rpc', '1', true);
  update public.profiles
     set login_count = login_count + 1, last_login_at = now(), last_seen_at = now(), presence = 'online'
   where id = auth.uid();
  insert into public.login_events (user_id) values (auth.uid());
end $$;

revoke execute on function public.heartbeat(text, uuid) from public, anon;
revoke execute on function public.record_login() from public, anon;
grant execute on function public.heartbeat(text, uuid) to authenticated;
grant execute on function public.record_login() to authenticated;

-- 10) Faqat ustoz uchun: eng ko'p xato qilingan savollar va mavzular (tekshiruv bazada)
create or replace function public.admin_question_stats(p_limit int default 50)
returns table (question text, subject text, topic text, answered bigint, wrong bigint, students_wrong bigint)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.question, min(a.subject), min(a.topic), count(*), count(*) filter (where not a.is_correct),
           count(distinct a.user_id) filter (where not a.is_correct)
      from public.attempt_answers a
     group by a.question
     order by 5 desc, 4 desc
     limit greatest(p_limit, 1);
end $$;

create or replace function public.admin_topic_stats()
returns table (subject text, topic text, answered bigint, wrong bigint, students_wrong bigint)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select a.subject, a.topic, count(*), count(*) filter (where not a.is_correct),
           count(distinct a.user_id) filter (where not a.is_correct)
      from public.attempt_answers a
     group by a.subject, a.topic;
end $$;

revoke execute on function public.admin_question_stats(int) from public, anon;
revoke execute on function public.admin_topic_stats() from public, anon;
grant execute on function public.admin_question_stats(int) to authenticated;
grant execute on function public.admin_topic_stats() to authenticated;

-- 11) Real vaqt (Supabase Realtime) — RLS qoidalari realtime uchun ham amal qiladi
do $$
declare t text;
begin
  foreach t in array array['profiles', 'attempts', 'test_sessions', 'login_events'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;

-- 12) Eski o'quvchilar uchun "oxirgi faollik" ni oxirgi testdan to'ldirish
update public.profiles p set last_seen_at = x.last_at
  from (select user_id, max(created_at) as last_at from public.attempts group by user_id) x
 where x.user_id = p.id and p.last_seen_at is null;
