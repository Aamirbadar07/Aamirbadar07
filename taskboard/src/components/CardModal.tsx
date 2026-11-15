import { useState, type FormEvent } from 'react'
import type { Card } from '../lib/types'
import { Modal } from './Modal'

interface Props {
  card: Card
  editable: boolean
  onSave: (changes: { title: string; description: string }) => void
  onDelete: () => void
  onClose: () => void
}

export function CardModal({ card, editable, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), description: description.trim() })
    onClose()
  }

  if (!editable) {
    return (
      <Modal title={card.title} onClose={onClose}>
        <p className="card-description">{card.description || 'No description.'}</p>
      </Modal>
    )
  }

  return (
    <Modal title="Edit card" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} required autoFocus />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            Delete card
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}
