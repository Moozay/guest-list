'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListUsersQueryKey,
  useCreateUser,
  useListUsers,
  useUpdateUser,
  type User,
  type UserRole,
} from '@workspace/api-client-react';
import { KeyRound, LoaderCircle, UserPlus, UsersRound } from 'lucide-react';

const roleLabels: Record<UserRole, string> = {
  event_planner: 'Event planner',
  guest_list_checker: 'Guest list checker',
};

export function UserManagement({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient();
  const users = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('guest_list_checker');
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');
    createUser.mutate(
      {
        data: {
          displayName: displayName.trim(),
          username: username.trim(),
          password,
          role,
        },
      },
      {
        onSuccess: (user) => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setDisplayName('');
          setUsername('');
          setPassword('');
          setRole('guest_list_checker');
          setSuccessMessage(`${user.displayName} can now sign in as a ${roleLabels[user.role]}.`);
        },
        onError: () => setFormError('The account could not be created. Check the details or choose a different username.'),
      },
    );
  }

  function updateAccount(user: User, changes: { role?: UserRole; isActive?: boolean; password?: string }, success: string) {
    setFormError('');
    setSuccessMessage('');
    updateUser.mutate(
      { id: user.id, data: changes },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setResetPasswords((previous) => ({ ...previous, [user.id]: '' }));
          setSuccessMessage(success);
        },
        onError: () => setFormError('The account could not be updated. At least one active event planner must remain.'),
      },
    );
  }

  return (
    <section className="panel user-management" aria-labelledby="user-management-heading">
      <div className="panel-header">
        <div>
          <h2 id="user-management-heading">Staff accounts</h2>
          <p>Only approved accounts can sign in.</p>
        </div>
        <div className="empty-icon user-panel-icon">
          <UsersRound size={16} />
        </div>
      </div>

      <div className="user-management-content">
        <form className="user-create-form" onSubmit={submit}>
          <h3><UserPlus size={15} /> Create staff account</h3>
          <div className="field">
            <label htmlFor="new-user-display-name">Full name</label>
            <input id="new-user-display-name" required minLength={2} maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="new-user-username">Username</label>
            <input id="new-user-username" autoComplete="off" required minLength={3} maxLength={64} pattern="[A-Za-z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="new-user-password">Temporary password</label>
            <input id="new-user-password" autoComplete="new-password" required minLength={12} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <span className="field-hint">Use at least 12 characters and share it with the staff member securely.</span>
          </div>
          <div className="field">
            <label htmlFor="new-user-role">Access role</label>
            <select
              id="new-user-role"
              value={role}
              onChange={(event) => {
                const selectedRole = event.target.value;
                if (selectedRole === 'event_planner' || selectedRole === 'guest_list_checker') {
                  setRole(selectedRole);
                }
              }}
            >
              <option value="guest_list_checker">Guest list checker</option>
              <option value="event_planner">Event planner</option>
            </select>
          </div>
          <button className="button button-primary" type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? <LoaderCircle size={14} className="spin" /> : <UserPlus size={14} />}
            {createUser.isPending ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div className="staff-account-list">
          <h3>Current accounts</h3>
          {users.isLoading && <p className="field-hint">Loading staff accounts…</p>}
          {users.isError && (
            <div className="error-state" role="alert">
              <strong>Staff accounts unavailable</strong>
              <button className="button button-outline button-small" type="button" onClick={() => void users.refetch()}>Try again</button>
            </div>
          )}
          {users.data?.map((user) => (
            <article className="staff-account-row" key={user.id}>
              <div className="staff-account-summary">
                <strong>{user.displayName}</strong>
                <span>{user.username}{user.id === currentUser.id ? ' · You' : ''} · {user.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="staff-account-controls">
                <select
                  aria-label={`Role for ${user.displayName}`}
                  value={user.role}
                  disabled={updateUser.isPending || user.id === currentUser.id}
                  onChange={(event) => {
                    const newRole = event.target.value;
                    if (newRole === 'event_planner' || newRole === 'guest_list_checker') {
                      updateAccount(user, { role: newRole }, `${user.displayName}'s role updated.`);
                    }
                  }}
                >
                  <option value="event_planner">Event planner</option>
                  <option value="guest_list_checker">Guest list checker</option>
                </select>
                <button
                  className={`button button-small ${user.isActive ? 'button-outline' : 'button-primary'}`}
                  type="button"
                  disabled={updateUser.isPending || user.id === currentUser.id}
                  onClick={() => updateAccount(user, { isActive: !user.isActive }, `${user.displayName}'s account ${user.isActive ? 'deactivated' : 'activated'}.`)}
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              {user.id !== currentUser.id && (
                <form
                  className="staff-password-reset"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const newPassword = resetPasswords[user.id] ?? '';
                    if (newPassword.length >= 12) {
                      updateAccount(user, { password: newPassword }, `${user.displayName}'s password was reset.`);
                    }
                  }}
                >
                  <KeyRound size={13} />
                  <input
                    aria-label={`New password for ${user.displayName}`}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    placeholder="Set a new password (12+ chars)"
                    type="password"
                    value={resetPasswords[user.id] ?? ''}
                    onChange={(event) => setResetPasswords((previous) => ({ ...previous, [user.id]: event.target.value }))}
                  />
                  <button className="button button-quiet button-small" type="submit" disabled={updateUser.isPending || (resetPasswords[user.id] ?? '').length < 12}>
                    Reset
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>

        {(formError || successMessage) && (
          <p className={formError ? 'scan-error' : 'success-message'} role={formError ? 'alert' : 'status'}>
            {formError || successMessage}
          </p>
        )}
      </div>
    </section>
  );
}
