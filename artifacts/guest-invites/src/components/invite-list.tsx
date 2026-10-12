'use client';

import { useMemo, useState } from 'react';
import type { Invite } from '@workspace/api-client-react';
import { Check, Clock3, QrCode, Search, UsersRound } from 'lucide-react';

type InviteListProps = {
  invites: Invite[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onShowQr: (invite: Invite) => void;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently added';
  }
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function InviteList({ invites, isLoading, isError, onRetry, onShowQr }: InviteListProps) {
  const [search, setSearch] = useState('');
  const filteredInvites = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const sortedInvites = [...(invites ?? [])].sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime() || 0;
      const rightTime = new Date(right.createdAt).getTime() || 0;
      return rightTime - leftTime;
    });

    if (!normalizedSearch) {
      return sortedInvites;
    }

    return sortedInvites.filter((invite) => (
      invite.fullName.toLowerCase().includes(normalizedSearch)
      || invite.inviteCode.toLowerCase().includes(normalizedSearch)
      || invite.email.toLowerCase().includes(normalizedSearch)
    ));
  }, [invites, search]);

  return (
    <section className="panel list-panel" aria-labelledby="invite-list-heading">
      <div className="panel-header">
        <div>
          <h2 id="invite-list-heading">Guest list</h2>
          <p>Every ticket, all in one place.</p>
        </div>
        <span className="count-chip" data-testid="text-invite-count">
          {invites?.length ?? '—'} INVITES
        </span>
      </div>

      <div className="list-tools">
        <div className="search-wrap">
          <Search size={15} />
          <input
            className="search-input"
            data-testid="input-search-invites"
            aria-label="Search guest list"
            placeholder="Find a guest or code"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="count-chip">{filteredInvites.length} shown</span>
      </div>

      <div className="invite-list">
        {isLoading && (
          <div aria-label="Loading invites" data-testid="loading-invites">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-row" key={index}>
                <div className="skeleton skeleton-circle" />
                <div className="skeleton-lines">
                  <div className="skeleton" style={{ width: '72%' }} />
                  <div className="skeleton" style={{ width: '47%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="error-state" role="alert">
            <div>
              <strong>Guest list unavailable</strong>
              <p>We couldn’t reach the invite list. Try again when your connection is ready.</p>
              <button className="button button-outline button-small" type="button" onClick={onRetry}>Try again</button>
            </div>
          </div>
        )}

        {!isLoading && !isError && filteredInvites.length === 0 && (
          <div className="empty-state">
            <div>
              <div className="empty-icon"><UsersRound size={21} /></div>
              <h3>{search ? 'No matches yet' : 'Your list starts here'}</h3>
              <p>
                {search
                  ? 'Try another name, email, or invite code.'
                  : 'Create the first ticket and it will appear here, ready to share.'}
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && filteredInvites.map((invite) => (
          <article className="invite-row" key={invite.id} data-testid={`row-invite-${invite.id}`}>
            <div className="invite-monogram" aria-hidden="true">{initials(invite.fullName)}</div>
            <div className="invite-main">
              <div className="invite-name" data-testid={`text-invite-name-${invite.id}`}>{invite.fullName}</div>
              <div className="invite-subline">
                <span className="invite-code">{invite.inviteCode}</span>
                <span aria-hidden="true">·</span>
                <span>{invite.numberOfGuests} {invite.numberOfGuests === 1 ? 'guest' : 'guests'}</span>
                <span aria-hidden="true">·</span>
                <span>{shortDate(invite.createdAt)}</span>
              </div>
            </div>
            <div className="invite-right">
              {invite.arrivedAt ? (
                <span className="arrived-badge" data-testid={`status-arrived-${invite.id}`}>
                  <Check size={11} /> Arrived
                </span>
              ) : (
                <span className="pending-badge" data-testid={`status-pending-${invite.id}`}>
                  <Clock3 size={10} /> Expected
                </span>
              )}
              <button
                className="row-qr"
                data-testid={`button-show-qr-${invite.id}`}
                type="button"
                onClick={() => onShowQr(invite)}
              >
                <QrCode size={10} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                Show QR
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
