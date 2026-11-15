// Every database call the app makes, in one place. Each function throws on
// failure so callers can show the message and roll back.
import { supabase } from './supabase'
import type { Board, BoardSummary, Card, List, Member, Role } from './types'

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// Boards ---------------------------------------------------------------------

export async function fetchBoards(userId: string): Promise<BoardSummary[]> {
  const rows = check(
    await supabase
      .from('board_members')
      .select('role, boards(id, title, owner_id, created_at)')
      .eq('user_id', userId),
  ) as unknown as { role: Role; boards: Board }[]
  return rows
    .map((row) => ({ ...row.boards, role: row.role }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function createBoard(title: string): Promise<Board> {
  // A database trigger makes the creator the board's owner.
  return check(await supabase.from('boards').insert({ title }).select().single()) as Board
}

export async function renameBoard(id: string, title: string) {
  check(await supabase.from('boards').update({ title }).eq('id', id))
}

export async function deleteBoard(id: string) {
  check(await supabase.from('boards').delete().eq('id', id))
}

/** Everything needed to draw one board. Returns null if it is not visible to the user. */
export async function fetchBoard(boardId: string) {
  const [board, lists, cards, members] = await Promise.all([
    supabase.from('boards').select().eq('id', boardId).maybeSingle(),
    supabase.from('lists').select().eq('board_id', boardId),
    supabase.from('cards').select().eq('board_id', boardId),
    supabase
      .from('board_members')
      .select('user_id, role, profiles(email, display_name)')
      .eq('board_id', boardId),
  ])
  const boardRow = check(board) as Board | null
  if (!boardRow) return null
  const memberRows = check(members) as unknown as {
    user_id: string
    role: Role
    profiles: { email: string; display_name: string }
  }[]
  return {
    board: boardRow,
    lists: check(lists) as List[],
    cards: check(cards) as Card[],
    members: memberRows.map<Member>((m) => ({
      user_id: m.user_id,
      role: m.role,
      email: m.profiles.email,
      display_name: m.profiles.display_name,
    })),
  }
}

// Lists ----------------------------------------------------------------------

export async function createList(list: List) {
  check(await supabase.from('lists').insert(list))
}

export async function renameList(id: string, title: string) {
  check(await supabase.from('lists').update({ title }).eq('id', id))
}

export async function deleteList(id: string) {
  check(await supabase.from('lists').delete().eq('id', id))
}

// Cards ----------------------------------------------------------------------

export async function createCard(card: Card) {
  check(await supabase.from('cards').insert(card))
}

export async function updateCard(id: string, changes: Partial<Pick<Card, 'title' | 'description'>>) {
  check(await supabase.from('cards').update(changes).eq('id', id))
}

export async function moveCard(id: string, listId: string, position: number) {
  check(await supabase.from('cards').update({ list_id: listId, position }).eq('id', id))
}

export async function deleteCard(id: string) {
  check(await supabase.from('cards').delete().eq('id', id))
}

// Members --------------------------------------------------------------------

export async function inviteMember(boardId: string, email: string, role: Role) {
  check(await supabase.rpc('invite_member', { p_board: boardId, p_email: email, p_role: role }))
}

export async function changeRole(boardId: string, userId: string, role: Role) {
  check(
    await supabase.from('board_members').update({ role }).eq('board_id', boardId).eq('user_id', userId),
  )
}

export async function removeMember(boardId: string, userId: string) {
  check(await supabase.from('board_members').delete().eq('board_id', boardId).eq('user_id', userId))
}
