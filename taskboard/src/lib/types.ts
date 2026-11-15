export type Role = 'owner' | 'member' | 'viewer'

export interface Board {
  id: string
  title: string
  owner_id: string
  created_at: string
}

export interface BoardSummary extends Board {
  role: Role
}

export interface List {
  id: string
  board_id: string
  title: string
  position: number
}

export interface Card {
  id: string
  board_id: string
  list_id: string
  title: string
  description: string
  position: number
}

export interface Member {
  user_id: string
  role: Role
  email: string
  display_name: string
}

/** Owners and members can change a board; viewers can only look. */
export const canEdit = (role: Role) => role !== 'viewer'
