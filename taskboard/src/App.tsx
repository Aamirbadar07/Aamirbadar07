import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { AuthPage } from './components/AuthPage'
import { BoardPage } from './components/BoardPage'
import { BoardsPage } from './components/BoardsPage'
import { supabase } from './lib/supabase'

// Tiny hash router: "#/" is the board list, "#/b/<id>" is one board.
function useBoardIdFromHash() {
  const read = () => window.location.hash.match(/^#\/b\/([\w-]+)$/)?.[1] ?? null
  const [boardId, setBoardId] = useState(read)
  useEffect(() => {
    const onChange = () => setBoardId(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return boardId
}

export default function App() {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const boardId = useBoardIdFromHash()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="center-note">Loading…</div>
  if (session === null) return <AuthPage />

  const user = session.user
  const name = (user.user_metadata.display_name as string | undefined) ?? user.email ?? ''

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <img src="/favicon.svg" alt="" width="22" height="22" />
          Taskboard
        </a>
        <div className="topbar-user">
          <span title={user.email}>{name}</span>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      {boardId ? (
        // key makes React start fresh when switching boards
        <BoardPage key={boardId} boardId={boardId} userId={user.id} />
      ) : (
        <BoardsPage userId={user.id} />
      )}
    </div>
  )
}
