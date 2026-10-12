'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetInviteSummaryQueryKey,
  getListInvitesQueryKey,
  useGetInviteSummary,
  useListInvites,
} from '@workspace/api-client-react';
import type { Invite } from '@workspace/api-client-react';
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
import { TicketQrDialog } from './ticket-qr-dialog';

type WorkspaceMode = 'invites' | 'checkin';

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
  const [mode, setMode] = useState<WorkspaceMode>('invites');
  const [ticketInvite, setTicketInvite] = useState<Invite | null>(null);
  const inviteList = useListInvites();
  const summary = useGetInviteSummary();

  function retryWorkspace() {
    void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
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

        <div className="event-card">
          <div className="eyebrow">At a glance</div>
          <div className="event-title">Door operations</div>
          <div className="event-meta">
            <CalendarDays size={13} />
            <span>Live guest list</span>
          </div>
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="side-nav" aria-label="Workspace">
          <button
            className={`nav-button${mode === 'invites' ? ' active' : ''}`}
            data-testid="nav-invites"
            type="button"
            aria-current={mode === 'invites' ? 'page' : undefined}
            onClick={() => setMode('invites')}
          >
            <ClipboardList size={17} />
            Invites
          </button>
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
            <strong>{mode === 'invites' ? 'Invites' : 'Check in'}</strong>
          </div>
          <div className="topbar-right">
            <div className="live-pill">
              <span className="status-dot" />
              Live list
            </div>
            <div className="user-avatar" title="Event staff">ES</div>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="heading-kicker">A calmer door starts here</div>
            <h1>{mode === 'invites' ? 'Invite desk' : 'Check-in desk'}</h1>
            <p>
              {mode === 'invites'
                ? 'Create a ticket, keep your list close, and let the door run smoothly.'
                : 'Scan a ticket and know exactly who you’re welcoming in.'}
            </p>
          </div>
          <div className="user-avatar" aria-hidden="true" style={{ width: 42, height: 42, background: '#e7e9d9', borderColor: '#d8dec9', color: '#536d58' }}>
            <DoorOpen size={19} />
          </div>
        </section>

        {summary.isError && (
          <div className="notice" role="alert">
            <CircleHelp size={14} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Arrival totals couldn’t load.
            <button className="button button-quiet button-small" type="button" onClick={retryWorkspace}>Retry</button>
          </div>
        )}

        <section className="summary-grid" aria-label="Invite and arrival totals">
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
        </section>

        {mode === 'invites' ? (
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
        ) : (
          <CheckInPanel />
        )}

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 25, color: '#929b9e', fontSize: 10 }}>
          <span><Check size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Guest tickets sync with the live list</span>
          {summary.isFetching && <span><LoaderCircle size={11} className="spin" style={{ verticalAlign: '-2px', marginRight: 4 }} /> Updating totals</span>}
          <button className="button button-quiet button-small" type="button" onClick={() => setMode(mode === 'invites' ? 'checkin' : 'invites')}>
            {mode === 'invites' ? <><UsersRound size={13} /> Go to check-in</> : <><ClipboardList size={13} /> Back to invites</>}
          </button>
        </footer>
      </main>

      {ticketInvite && (
        <TicketQrDialog invite={ticketInvite} onClose={() => setTicketInvite(null)} />
      )}
    </div>
  );
}
