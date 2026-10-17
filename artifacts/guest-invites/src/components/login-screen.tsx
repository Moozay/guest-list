'use client';

import { useState, type FormEvent } from 'react';
import { useLogin, type User } from '@workspace/api-client-react';
import { LoaderCircle, LockKeyhole, TicketCheck } from 'lucide-react';

type LoginScreenProps = {
  onLogin: (user: User) => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const login = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    login.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: ({ user }) => onLogin(user),
        onError: () => {
          setLoginError(
            'Sign in failed. Check your username and password, or try again later if sign-in is temporarily limited.',
          );
        },
      },
    );
  }

  return (
    <main className="auth-page">
      <section className="panel auth-panel" aria-labelledby="login-heading">
        <div className="auth-brand">
          <div className="brand-mark"><TicketCheck size={20} /></div>
          <span>Guest Invites</span>
        </div>
        <div className="auth-icon"><LockKeyhole size={20} /></div>
        <h1 id="login-heading">Staff sign in</h1>
        <p className="auth-description">Sign in with an approved event staff account.</p>
        <form className="form-body" onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              autoComplete="username"
              required
              maxLength={64}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              autoComplete="current-password"
              required
              maxLength={128}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {loginError && <p className="scan-error" role="alert">{loginError}</p>}
          <button className="button button-primary button-wide" type="submit" disabled={login.isPending}>
            {login.isPending ? <LoaderCircle className="spin" size={15} /> : <LockKeyhole size={15} />}
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
