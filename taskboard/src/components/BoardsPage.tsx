import { useEffect, useState, type FormEvent } from 'react'
import * as api from '../lib/api'
import type { BoardSummary } from '../lib/types'

export function BoardsPage({ userId }: { userId: string }) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.fetchBoards(userId).then(setBoards, (e: Error) => setError(e.message))
  }, [userId])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      const board = await api.createBoard(trimmed)
      window.location.hash = `#/b/${board.id}`
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <main className="boards">
      <h1>Your boards</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {boards === null && !error && <p className="muted">Loading…</p>}
      <div className="board-grid">
        {boards?.map((board) => (
          <a key={board.id} className="board-tile" href={`#/b/${board.id}`}>
            <span className="board-tile-title">{board.title}</span>
            <span className={`role role-${board.role}`}>{board.role}</span>
          </a>
        ))}
        <form className="board-tile new" onSubmit={onCreate}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New board title"
            aria-label="New board title"
            maxLength={120}
          />
          <button className="btn primary" disabled={!title.trim()}>
            Create board
          </button>
        </form>
      </div>
    </main>
  )
}
