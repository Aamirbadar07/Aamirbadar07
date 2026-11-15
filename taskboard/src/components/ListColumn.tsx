import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type FormEvent } from 'react'
import type { Card, List } from '../lib/types'

interface Props {
  list: List
  cards: Card[]
  editable: boolean
  onRename: (title: string) => void
  onDelete: () => void
  onAddCard: (title: string) => void
  onOpenCard: (card: Card) => void
}

export function ListColumn({ list, cards, editable, onRename, onDelete, onAddCard, onOpenCard }: Props) {
  // The whole column is a drop target so cards can be dropped on an empty list.
  const { setNodeRef } = useDroppable({ id: list.id })
  const [newTitle, setNewTitle] = useState('')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!newTitle.trim()) return
    onAddCard(newTitle.trim())
    setNewTitle('')
  }

  return (
    <section className="list" ref={setNodeRef} aria-label={list.title}>
      <header className="list-header">
        {editable ? (
          <input
            className="list-title"
            defaultValue={list.title}
            key={list.title}
            aria-label="List title"
            maxLength={120}
            onBlur={(e) => {
              const title = e.target.value.trim()
              if (title && title !== list.title) onRename(title)
              else e.target.value = list.title
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <h2 className="list-title">{list.title}</h2>
        )}
        <span className="count">{cards.length}</span>
        {editable && (
          <button
            className="btn ghost icon"
            aria-label={`Delete list ${list.title}`}
            title="Delete list"
            onClick={() => {
              if (cards.length === 0 || confirm(`Delete "${list.title}" and its ${cards.length} card(s)?`)) onDelete()
            }}
          >
            ✕
          </button>
        )}
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="cards">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} editable={editable} onOpen={() => onOpenCard(card)} />
          ))}
        </div>
      </SortableContext>

      {editable && (
        <form className="add-card" onSubmit={onSubmit}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="+ Add a card"
            aria-label={`Add a card to ${list.title}`}
            maxLength={500}
          />
        </form>
      )}
    </section>
  )
}

function SortableCard(props: { card: Card; editable: boolean; onOpen: () => void }) {
  const { card, editable, onOpen } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !editable, // viewers cannot drag
  })

  return (
    <article
      ref={setNodeRef}
      className={`card${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onOpen}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isDragging) onOpen()
        else listeners?.onKeyDown?.(e)
      }}
    >
      <CardFace card={card} />
    </article>
  )
}

export function CardFace({ card }: { card: Card }) {
  return (
    <>
      <span>{card.title}</span>
      {card.description && <small className="muted has-description" title="Has a description">≡</small>}
    </>
  )
}
