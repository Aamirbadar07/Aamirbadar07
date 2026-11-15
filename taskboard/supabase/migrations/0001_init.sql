-- Taskboard schema: boards, lists, cards, and role-based membership.
-- Access rules live in the database (Row Level Security), so the browser
-- can never do more than the signed-in user's role allows.

create type public.board_role as enum ('owner', 'member', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.board_role not null,
  primary key (board_id, user_id)
);
create index board_members_user_idx on public.board_members (user_id);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  position double precision not null,
  created_at timestamptz not null default now()
);
create index lists_board_idx on public.lists (board_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text not null default '',
  position double precision not null,
  created_at timestamptz not null default now()
);
create index cards_board_idx on public.cards (board_id);
create index cards_list_idx on public.cards (list_id);

-- Helpers live in a schema the API does not expose.
create schema private;
grant usage on schema private to authenticated;

-- The current user's role on a board (null when not a member).
create function private.role_on(p_board uuid)
returns public.board_role
language sql stable security definer set search_path = ''
as $$
  select role from public.board_members
  where board_id = p_board and user_id = (select auth.uid());
$$;

-- True when the current user shares at least one board with p_user.
create function private.shares_board_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members mine
    join public.board_members theirs using (board_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

create function private.find_user_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.profiles where email = lower(trim(p_email));
$$;

-- A profile row is created for every new auth user.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Whoever creates a board becomes its owner.
create function private.handle_new_board()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_board_created
  after insert on public.boards
  for each row execute function private.handle_new_board();

-- A card must stay on the board that its list belongs to.
create function private.check_card_board()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lists where id = new.list_id and board_id = new.board_id
  ) then
    raise exception 'card list must belong to the same board';
  end if;
  return new;
end;
$$;

create trigger cards_check_board
  before insert or update of list_id, board_id on public.cards
  for each row execute function private.check_card_board();

-- Owners invite people by email; this is the only way to add a member.
create function public.invite_member(p_board uuid, p_email text, p_role public.board_role)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid;
begin
  if private.role_on(p_board) is distinct from 'owner' then
    raise exception 'Only the board owner can invite people';
  end if;
  if p_role = 'owner' then
    raise exception 'A board has exactly one owner';
  end if;
  v_user := private.find_user_by_email(p_email);
  if v_user is null then
    raise exception 'No account found for %. Ask them to sign up first.', p_email;
  end if;
  insert into public.board_members (board_id, user_id, role)
  values (p_board, v_user, p_role)
  on conflict (board_id, user_id) do update set role = excluded.role
  where public.board_members.role <> 'owner';
end;
$$;

revoke execute on function public.invite_member(uuid, text, public.board_role) from public, anon;
grant execute on function public.invite_member(uuid, text, public.board_role) to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Row Level Security -------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;

create policy "see own profile and co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_board_with(id));

create policy "members can see their boards" on public.boards
  for select to authenticated
  using (owner_id = (select auth.uid()) or private.role_on(id) is not null);
create policy "anyone signed in can create a board" on public.boards
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "owner can rename board" on public.boards
  for update to authenticated
  using (private.role_on(id) = 'owner')
  with check (owner_id = (select auth.uid()));
create policy "owner can delete board" on public.boards
  for delete to authenticated
  using (private.role_on(id) = 'owner');

create policy "members can see the member list" on public.board_members
  for select to authenticated
  using (private.role_on(board_id) is not null);
create policy "owner can add members" on public.board_members
  for insert to authenticated
  with check (private.role_on(board_id) = 'owner' and role <> 'owner');
create policy "owner can change roles" on public.board_members
  for update to authenticated
  using (private.role_on(board_id) = 'owner' and role <> 'owner')
  with check (role <> 'owner');
create policy "owner can remove members, members can leave" on public.board_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (private.role_on(board_id) = 'owner' or user_id = (select auth.uid()))
  );

create policy "members can see lists" on public.lists
  for select to authenticated
  using (private.role_on(board_id) is not null);
create policy "owner and members can add lists" on public.lists
  for insert to authenticated
  with check (private.role_on(board_id) in ('owner', 'member'));
create policy "owner and members can edit lists" on public.lists
  for update to authenticated
  using (private.role_on(board_id) in ('owner', 'member'))
  with check (private.role_on(board_id) in ('owner', 'member'));
create policy "owner and members can delete lists" on public.lists
  for delete to authenticated
  using (private.role_on(board_id) in ('owner', 'member'));

create policy "members can see cards" on public.cards
  for select to authenticated
  using (private.role_on(board_id) is not null);
create policy "owner and members can add cards" on public.cards
  for insert to authenticated
  with check (private.role_on(board_id) in ('owner', 'member'));
create policy "owner and members can edit cards" on public.cards
  for update to authenticated
  using (private.role_on(board_id) in ('owner', 'member'))
  with check (private.role_on(board_id) in ('owner', 'member'));
create policy "owner and members can delete cards" on public.cards
  for delete to authenticated
  using (private.role_on(board_id) in ('owner', 'member'));

-- Table privileges: signed-in users only; RLS narrows it further.
revoke all on public.profiles, public.boards, public.board_members, public.lists, public.cards from anon;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.boards, public.board_members, public.lists, public.cards to authenticated;

-- Live updates for everyone looking at the same board.
alter publication supabase_realtime add table public.lists, public.cards, public.board_members;
