import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import { byPosition, positionBetween } from '../lib/position'
import { supabase } from '../lib/supabase'
import { canEdit, type Board, type Card, type List, type Member, type Role } from '../lib/types'
import { CardModal } from './CardModal'
import { CardFace, ListColumn } from './ListColumn'
import { MembersModal } from './MembersModal'

export function BoardPage({ boardId, userId }: { boardId: string; userId: string }) {
  const [board, setBoard] = useState<Board | null>(null)
  const [lists, setLists] = useState<List[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [error, setError] = useState('')

  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')

  // Drag state: the card being dragged, and where it started (to detect a real move).
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)
  const dragOrigin = useRef<Card | null>(null)

  const myRole: Role = members.find((m) => m.user_id === userId)?.role ?? 'viewer'
  const editable = canEdit(myRole)
  const isOwner = myRole === 'owner'

  // Loading -------------------------------------------------------------------

  const reload = useCallback(async () => {
    try {
      const data = await api.fetchBoard(boardId)
      if (!data || !data.members.some((m) => m.user_id === userId)) return setStatus('missing')
      setBoard(data.board)
      setLists(data.lists)
      setCards(data.cards)
      setMembers(data.members)
      setStatus('ready')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [boardId, userId])

  useEffect(() => {
    reload()
  }, [reload])

  // Live updates: when anyone changes this board, fetch it again. Row Level
  // Security decides which change events this user is allowed to receive.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!dragOrigin.current) reload() // never swap data under an active drag
      }, 300)
    }
    const channel = supabase
      .channel(`board-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, refresh)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [boardId, reload])

  /**
   * Optimistic update: change the screen first, then save. If saving fails
   * (for example the database rejects it), show why and reload the truth.
   */
  async function save(applyLocally: () => void, persist: () => Promise<void>) {
    applyLocally()
    try {
      await persist()
    } catch (e) {
      setError((e as Error).message)
      await reload()
    }
  }

  // Lists and cards -----------------------------------------------------------

  const sortedLists = [...lists].sort(byPosition)
  const cardsIn = (listId: string) => cards.filter((c) => c.list_id === listId).sort(byPosition)

  function addList(event: FormEvent) {
    event.preventDefault()
    const title = newListTitle.trim()
    if (!title) return
    const list: List = {
      id: crypto.randomUUID(),
      board_id: boardId,
      title,
      position: positionBetween(sortedLists.at(-1)?.position, undefined),
    }
    setNewListTitle('')
    save(() => setLists((all) => [...all, list]), () => api.createList(list))
  }

  function addCard(listId: string, title: string) {
    const card: Card = {
      id: crypto.randomUUID(),
      board_id: boardId,
      list_id: listId,
      title,
      description: '',
      position: positionBetween(cardsIn(listId).at(-1)?.position, undefined),
    }
    save(() => setCards((all) => [...all, card]), () => api.createCard(card))
  }

  const patchCard = (id: string, changes: Partial<Card>) =>
    setCards((all) => all.map((c) => (c.id === id ? { ...c, ...changes } : c)))

  // Drag and drop -------------------------------------------------------------

  const sensors = useSensors(
    // A small distance / delay keeps plain clicks and scrolling working.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragStart({ active }: DragStartEvent) {
    const card = cards.find((c) => c.id === active.id) ?? null
    dragOrigin.current = card
    setDraggedCard(card)
  }

  // While hovering over another list, move the card there right away so the
  // target list opens a gap. Nothing is saved until the card is dropped.
  function onDragOver({ active, over }: DragOverEvent) {
    const card = cards.find((c) => c.id === active.id)
    if (!card || !over) return
    const overCard = cards.find((c) => c.id === over.id)
    const targetListId = overCard ? overCard.list_id : String(over.id)
    if (targetListId === card.list_id) return

    const target = cardsIn(targetListId)
    const index = overCard ? target.findIndex((c) => c.id === overCard.id) : target.length
    patchCard(card.id, {
      list_id: targetListId,
      position: positionBetween(target[index - 1]?.position, target[index]?.position),
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const origin = dragOrigin.current
    dragOrigin.current = null
    setDraggedCard(null)
    const card = cards.find((c) => c.id === active.id)
    if (!card || !origin) return

    // Reordering inside one list: work out the new neighbours.
    let position = card.position
    const siblings = cardsIn(card.list_id)
    const from = siblings.findIndex((c) => c.id === card.id)
    const to = over ? siblings.findIndex((c) => c.id === over.id) : -1
    if (to !== -1 && to !== from) {
      const reordered = arrayMove(siblings, from, to)
      position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position)
    }

    if (card.list_id === origin.list_id && position === origin.position) return
    save(
      () => patchCard(card.id, { position }),
      () => api.moveCard(card.id, card.list_id, position),
    )
  }

  function onDragCancel() {
    const origin = dragOrigin.current
    dragOrigin.current = null
    setDraggedCard(null)
    if (origin) patchCard(origin.id, { list_id: origin.list_id, position: origin.position })
  }

  // Rendering -----------------------------------------------------------------

  if (status === 'loading') return <div className="center-note">{error || 'Loading board…'}</div>
  if (status === 'missing' || !board) {
    return (
      <div className="center-note">
        This board does not exist or you do not have access to it. <a href="#/">Back to your boards</a>
      </div>
    )
  }

  const openCard = cards.find((c) => c.id === openCardId)

  return (
    <main className="board">
      <div className="board-bar">
        <a className="btn ghost" href="#/">
          ← Boards
        </a>
        {isOwner ? (
          <input
            className="board-title"
            defaultValue={board.title}
            key={board.title}
            aria-label="Board title"
            maxLength={120}
            onBlur={(e) => {
              const title = e.target.value.trim()
              if (!title || title === board.title) return void (e.target.value = board.title)
              save(() => setBoard({ ...board, title }), () => api.renameBoard(board.id, title))
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <h1 className="board-title">{board.title}</h1>
        )}
        <span className={`role role-${myRole}`}>{myRole}</span>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowMembers(true)}>
          Members ({members.length})
        </button>
        {isOwner && (
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Delete the board "${board.title}" for everyone?`)) return
              try {
                await api.deleteBoard(board.id)
                window.location.hash = '#/'
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          >
            Delete board
          </button>
        )}
      </div>

      {!editable && <p className="banner">You are a viewer on this board, so it is read-only.</p>}
      {error && (
        <p className="banner error" role="alert">
          {error}{' '}
          <button className="btn ghost" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="lists">
          {sortedLists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              cards={cardsIn(list.id)}
              editable={editable}
              onRename={(title) =>
                save(
                  () => setLists((all) => all.map((l) => (l.id === list.id ? { ...l, title } : l))),
                  () => api.renameList(list.id, title),
                )
              }
              onDelete={() =>
                save(
                  () => {
                    setLists((all) => all.filter((l) => l.id !== list.id))
                    setCards((all) => all.filter((c) => c.list_id !== list.id))
                  },
                  () => api.deleteList(list.id),
                )
              }
              onAddCard={(title) => addCard(list.id, title)}
              onOpenCard={(card) => setOpenCardId(card.id)}
            />
          ))}
          {editable && (
            <form className="list add-list" onSubmit={addList}>
              <input
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="+ Add a list"
                aria-label="Add a list"
                maxLength={120}
              />
            </form>
          )}
          {sortedLists.length === 0 && !editable && <p className="muted">This board has no lists yet.</p>}
        </div>

        {/* The floating copy of the card that follows the pointer. */}
        <DragOverlay>
          {draggedCard && (
            <article className="card overlay">
              <CardFace card={draggedCard} />
            </article>
          )}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardModal
          card={openCard}
          editable={editable}
          onClose={() => setOpenCardId(null)}
          onSave={(changes) =>
            save(() => patchCard(openCard.id, changes), () => api.updateCard(openCard.id, changes))
          }
          onDelete={() =>
            save(
              () => setCards((all) => all.filter((c) => c.id !== openCard.id)),
              () => api.deleteCard(openCard.id),
            )
          }
        />
      )}

      {showMembers && (
        <MembersModal
          members={members}
          myRole={myRole}
          onClose={() => setShowMembers(false)}
          onInvite={async (email, role) => {
            await api.inviteMember(boardId, email, role)
            await reload()
          }}
          onChangeRole={(memberId, role) =>
            save(
              () => setMembers((all) => all.map((m) => (m.user_id === memberId ? { ...m, role } : m))),
              () => api.changeRole(boardId, memberId, role),
            )
          }
          onRemove={(memberId) =>
            save(
              () => setMembers((all) => all.filter((m) => m.user_id !== memberId)),
              () => api.removeMember(boardId, memberId),
            )
          }
        />
      )}
    </main>
  )
}
