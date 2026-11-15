import { useState, type FormEvent } from 'react'
import type { Member, Role } from '../lib/types'
import { Modal } from './Modal'

interface Props {
  members: Member[]
  myRole: Role
  onInvite: (email: string, role: Role) => Promise<void>
  onChangeRole: (userId: string, role: Role) => void
  onRemove: (userId: string) => void
  onClose: () => void
}

const ROLE_HELP: Record<Role, string> = {
  owner: 'Full control, including members and deleting the board',
  member: 'Can add, edit and move lists and cards',
  viewer: 'Can look, but not change anything',
}

export function MembersModal({ members, myRole, onInvite, onChangeRole, onRemove, onClose }: Props) {
  const isOwner = myRole === 'owner'
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onInvite(email.trim(), role)
      setEmail('')
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Modal title="Board members" onClose={onClose}>
      <ul className="member-list">
        {members.map((member) => (
          <li key={member.user_id}>
            <div>
              <strong>{member.display_name}</strong>
              <small className="muted">{member.email}</small>
            </div>
            {isOwner && member.role !== 'owner' ? (
              <>
                <select
                  value={member.role}
                  aria-label={`Role for ${member.display_name}`}
                  onChange={(e) => onChangeRole(member.user_id, e.target.value as Role)}
                >
                  <option value="member">member</option>
                  <option value="viewer">viewer</option>
                </select>
                <button className="btn ghost" onClick={() => onRemove(member.user_id)}>
                  Remove
                </button>
              </>
            ) : (
              <span className={`role role-${member.role}`} title={ROLE_HELP[member.role]}>
                {member.role}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form className="invite" onSubmit={onSubmit}>
          <label>
            Invite by email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </label>
          <div className="invite-row">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
            <button className="btn primary" disabled={busy}>
              Invite
            </button>
          </div>
          <small className="muted">{ROLE_HELP[role]}. They need an account first.</small>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      ) : (
        <p className="muted">Only the board owner can invite people or change roles.</p>
      )}
    </Modal>
  )
}
