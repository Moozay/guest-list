'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCurrentUserQueryKey,
  getGetInviteSummaryQueryKey,
  getListInvitesQueryKey,
  useGetCurrentUser,
  useGetInviteSummary,
  useListInvites,
  useLogout,
} from '@workspace/api-client-react';
import type { Invite, User } from '@workspace/api-client-react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  DoorOpen,
  LoaderCircle,
  ScanLine,
  TicketCheck,
  UsersRound,
} from 'lucide-react';
import { CheckInPanel } from './check-in-panel';
import { InviteForm } from './invite-form';
import { InviteList } from './invite-list';
import { LoginScreen } from './login-screen';
import { TicketQrDialog } from './ticket-qr-dialog';
import { UserManagement } from './user-management';

type WorkspaceMode = 'invites' | 'checkin' | 'users';

function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }
  return undefined;
}

function SummaryCard({
  label,
  value,
  detail,
  primary = false,
}: {
  label: string;
  value: number;
  detail: string;
  primary?: boolean;
}) {
  return (
    <article className={`summary-card${primary ? ' primary-card' : ''}`}>
      <div className="summary-label">{label}</div>
      <div className="summary-value" data-testid={`text-summary-${label.toLowerCase().replaceAll(' ', '-')}`}>
        {value.toLocaleString()}
      </div>
      <div className="summary-detail">{detail}</div>
    </article>
  );
}

export default function GuestInvitesApp() {
  const queryClient = useQueryClient();
  const currentUserQuery = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  const logout = useLogout();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>('invites');
  const [ticketInvite, setTicketInvite] = useState<Invite | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const currentUser = sessionUser ?? (signedOut ? null : currentUserQuery.data?.user ?? null);
  const isPlanner = currentUser?.role === 'event_planner';
  const inviteList = useListInvites({
    query: { queryKey: getListInvitesQueryKey(), enabled: isPlanner },
  });
  const summary = useGetInviteSummary({
    query: { queryKey: getGetInviteSummaryQueryKey(), enabled: isPlanner },
  });

  useEffect(() => {
    if (currentUser?.role === 'guest_list_checker') setMode('checkin');
    else if (currentUser?.role === 'event_planner') setMode('invites');
  }, [currentUser?.role]);

  function retryWorkspace() {
    void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
  }

  function handleLogin(user: User) {
    setSignedOut(false);
    setSessionUser(user);
    queryClient.setQueryData(getGetCurrentUserQueryKey(), { user });
    setMode(user.role === 'event_planner' ? 'invites' : 'checkin');
  }

  function handleLogout() {
    setLogoutError('');
    logout.mutate(undefined, {
      onSuccess: () => {
        setSignedOut(true);
        setSessionUser(null);
        setTicketInvite(null);
        queryClient.clear();
      },
      onError: () => setLogoutError('Could not sign out. Check your connection and try again.'),
    });
  }

  if (!currentUser && currentUserQuery.isPending && !signedOut) {
    return <main className="auth-page"><div className="auth-loading"><LoaderCircle className="spin" size={19} /> Checking your session…</div></main>;
  }

  if (!currentUser && currentUserQuery.isError && errorStatus(currentUserQuery.error) !== 401 && !signedOut) {
    return (
      <main className="auth-page">
        <section className="panel auth-panel" role="alert">
          <h1>Unable to reach the sign-in service</h1>
          <p className="auth-description">The session could not be checked. Confirm the app is connected, then try again.</p>
          <button className="button button-primary button-wide" type="button" onClick={() => void currentUserQuery.refetch()}>Retry</button>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand" aria-label="Guest Invites">
          <div className="brand-mark"><TicketCheck size={20} strokeWidth={2.1} /></div>
          <div>
            <div className="brand-name">Guest Invites</div>
            <div className="brand-caption">The door, sorted.</div>
          </div>
        </div>

        {isPlanner && <div className="event-card">
          <div className="eyebrow">At a glance</div>
          <div className="event-title">Door operations</div>
          <div className="event-meta">
            <CalendarDays size={13} />
            <span>Live guest list</span>
          </div>
        </div>}

        <div className="nav-label">Workspace</div>
        <nav className="side-nav" aria-label="Workspace">
          {isPlanner && <button
            className={`nav-button${mode === 'invites' ? ' active' : ''}`}
            data-testid="nav-invites"
            type="button"
            aria-current={mode === 'invites' ? 'page' : undefined}
            onClick={() => setMode('invites')}
          >
            <ClipboardList size={17} />
            Invites
          </button>}
          <button
            className={`nav-button${mode === 'checkin' ? ' active' : ''}`}
            data-testid="nav-check-in"
            type="button"
            aria-current={mode === 'checkin' ? 'page' : undefined}
            onClick={() => setMode('checkin')}
          >
            <ScanLine size={17} />
            Check in
          </button>
          {isPlanner && <button
            className={`nav-button${mode === 'users' ? ' active' : ''}`}
            type="button"
            aria-current={mode === 'users' ? 'page' : undefined}
            onClick={() => setMode('users')}
          >
            <UsersRound size={17} />
            Staff accounts
          </button>}
        </nav>

        <div className="sidebar-bottom">
          <div className="door-status">
            <span className="status-dot" />
            Door is ready
          </div>
          <div className="sidebar-note">Tickets update as guests arrive.</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} style={{ verticalAlign: '-2px', margin: '0 4px' }} />
            <strong>{mode === 'invites' ? 'Invites' : mode === 'users' ? 'Staff accounts' : 'Check in'}</strong>
          </div>
          <div className="topbar-right">
            {isPlanner && <div className="live-pill"><span className="status-dot" />Live list</div>}
            <span className="signed-in-name">{currentUser.displayName}</span>
            <button className="button button-quiet button-small" type="button" onClick={handleLogout} disabled={logout.isPending}>
              {logout.isPending ? <LoaderCircle size={13} className="spin" /> : <DoorOpen size={13} />}
              Sign out
            </button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="heading-kicker">{currentUser.role === 'event_planner' ? 'Event planner' : 'Guest list checker'}</div>
            <h1>{mode === 'invites' ? 'Invite desk' : mode === 'users' ? 'Staff accounts' : 'Check-in desk'}</h1>
            <p>
              {mode === 'invites'
                ? 'Create a ticket, keep your list close, and let the door run smoothly.'
                : mode === 'users'
                  ? 'Create approved staff accounts and manage their access.'
                  : 'Scan a ticket and know exactly who you’re welcoming in.'}
            </p>
          </div>
          <div className="user-avatar role-avatar" aria-hidden="true">
            <DoorOpen size={19} />
          </div>
        </section>

        {logoutError && <div className="notice" role="alert">{logoutError}</div>}

        {isPlanner && mode !== 'users' && summary.isError && (
          <div className="notice" role="alert">
            <CircleHelp size={14} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Arrival totals couldn’t load.
            <button className="button button-quiet button-small" type="button" onClick={retryWorkspace}>Retry</button>
          </div>
        )}

        {isPlanner && mode !== 'users' && <section className="summary-grid" aria-label="Invite and arrival totals">
          {summary.isLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <div className={`summary-card${index === 0 ? ' primary-card' : ''}`} key={index} aria-label="Loading totals">
                <div className="skeleton" style={{ width: '56%', height: 9 }} />
                <div className="skeleton" style={{ width: '31%', height: 25, marginTop: 14, backgroundColor: 'rgba(200, 205, 193, .32)' }} />
                <div className="skeleton" style={{ width: '70%', height: 8, marginTop: 8 }} />
              </div>
            ))
          ) : summary.data ? (
            <>
              <SummaryCard
                label="Guests invited"
                value={summary.data.totalGuests}
                detail="People on the list"
                primary
              />
              <SummaryCard
                label="Tickets"
                value={summary.data.totalInvites}
                detail="Individual invitations"
              />
              <SummaryCard
                label="Checked in"
                value={summary.data.arrivedGuests}
                detail={`${summary.data.arrivedInvites} ${summary.data.arrivedInvites === 1 ? 'ticket' : 'tickets'} arrived`}
              />
              <SummaryCard
                label="Still expected"
                value={Math.max(0, summary.data.totalGuests - summary.data.arrivedGuests)}
                detail="Guests not yet arrived"
              />
            </>
          ) : (
            <div className="summary-card" style={{ gridColumn: '1 / -1', minHeight: 82 }}>
              <div className="summary-label">Invite totals</div>
              <div className="summary-detail" style={{ marginTop: 12 }}>Totals will appear when the guest list is available.</div>
            </div>
          )}
        </section>}

        {mode === 'invites' && isPlanner ? (
          <section className="workspace-grid" aria-label="Manage invitations">
            <InviteForm onCreated={setTicketInvite} />
            <InviteList
              invites={inviteList.data}
              isLoading={inviteList.isLoading}
              isError={inviteList.isError}
              onRetry={() => void inviteList.refetch()}
              onShowQr={setTicketInvite}
            />
          </section>
        ) : mode === 'users' && isPlanner ? (
          <UserManagement currentUser={currentUser} />
        ) : (
          <CheckInPanel />
        )}

        {mode !== 'users' && <footer className="workspace-footer">
          <span><Check size={11} /> Guest tickets sync with the live list</span>
          {isPlanner && summary.isFetching && <span><LoaderCircle size={11} className="spin" /> Updating totals</span>}
          {isPlanner && <button className="button button-quiet button-small" type="button" onClick={() => setMode(mode === 'invites' ? 'checkin' : 'invites')}>
            {mode === 'invites' ? <><UsersRound size={13} /> Go to check-in</> : <><ClipboardList size={13} /> Back to invites</>}
          </button>}
        </footer>}
      </main>

      {ticketInvite && (
        <TicketQrDialog invite={ticketInvite} onClose={() => setTicketInvite(null)} />
      )}
    </div>
  );
}
