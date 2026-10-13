'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetInviteSummaryQueryKey,
  getListInvitesQueryKey,
  useDeleteInvite,
  useUpdateInvite,
  type Invite,
  type InviteInput,
} from '@workspace/api-client-react';
import { Check, Clock3, Minus, PencilLine, Plus, QrCode, Search, Trash2, UsersRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type InviteListProps = {
  invites: Invite[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onShowQr: (invite: Invite) => void;
};

type FieldErrors = Partial<Record<keyof InviteInput, string>>;
type EditInviteInput = InviteInput & Pick<Invite, 'rsvpStatus'>;

const initialFormValues: EditInviteInput = {
  fullName: '',
  numberOfGuests: 1,
  phoneNumber: '',
  email: '',
  rsvpStatus: 'pending',
};

const rsvpStatusLabels: Record<Invite['rsvpStatus'], string> = {
  pending: 'Pending RSVP',
  accepted: 'Accepted',
  declined: 'Declined',
};

function isRsvpStatus(value: string): value is Invite['rsvpStatus'] {
  return value === 'pending' || value === 'accepted' || value === 'declined';
}

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

function validateInviteForm(values: InviteInput): FieldErrors {
  const nextErrors: FieldErrors = {};
  const trimmedName = values.fullName.trim();
  const trimmedPhone = values.phoneNumber.trim();
  const trimmedEmail = values.email.trim();

  if (trimmedName.length < 2) {
    nextErrors.fullName = 'Enter at least 2 characters.';
  } else if (trimmedName.length > 120) {
    nextErrors.fullName = 'Keep the name under 120 characters.';
  }

  if (!Number.isInteger(values.numberOfGuests) || values.numberOfGuests < 1 || values.numberOfGuests > 20) {
    nextErrors.numberOfGuests = 'Choose between 1 and 20 guests.';
  }

  const phoneDigits = trimmedPhone.replace(/\D/g, '').length;
  if (
    trimmedPhone.length < 5
    || trimmedPhone.length > 30
    || phoneDigits < 5
    || !/^[+()\d\s.-]+$/.test(trimmedPhone)
  ) {
    nextErrors.phoneNumber = 'Enter a phone number between 5 and 30 characters.';
  }

  if (!trimmedEmail) {
    nextErrors.email = 'Enter an email address.';
  } else if (trimmedEmail.length > 254) {
    nextErrors.email = 'Email must be 254 characters or fewer.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    nextErrors.email = 'Enter a valid email address.';
  }

  return nextErrors;
}

export function InviteList({ invites, isLoading, isError, onRetry, onShowQr }: InviteListProps) {
  const queryClient = useQueryClient();
  const updateInvite = useUpdateInvite();
  const deleteInvite = useDeleteInvite();
  const [search, setSearch] = useState('');
  const [editingInvite, setEditingInvite] = useState<Invite | null>(null);
  const [formValues, setFormValues] = useState<EditInviteInput>(initialFormValues);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});

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

  function openEditor(invite: Invite) {
    setEditingInvite(invite);
    setFormValues({
      fullName: invite.fullName,
      numberOfGuests: invite.numberOfGuests,
      phoneNumber: invite.phoneNumber,
      email: invite.email,
      rsvpStatus: invite.rsvpStatus,
    });
    setFormErrors({});
  }

  function closeEditor() {
    setEditingInvite(null);
    setFormValues(initialFormValues);
    setFormErrors({});
  }

  function updateForm<K extends keyof EditInviteInput>(key: K, value: EditInviteInput[K]) {
    setFormValues((previous) => ({ ...previous, [key]: value }));
    setFormErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function submitUpdate() {
    if (!editingInvite) {
      return;
    }

    const nextErrors = validateInviteForm(formValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    updateInvite.mutate(
      {
        id: editingInvite.id,
        data: {
          fullName: formValues.fullName.trim(),
          numberOfGuests: formValues.numberOfGuests,
          phoneNumber: formValues.phoneNumber.trim(),
          email: formValues.email.trim(),
          rsvpStatus: formValues.rsvpStatus,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
          closeEditor();
        },
      },
    );
  }

  function submitDelete() {
    if (!editingInvite) {
      return;
    }

    deleteInvite.mutate(
      { id: editingInvite.id },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
          closeEditor();
        },
      },
    );
  }

  return (
    <>
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
                <span className={`rsvp-badge rsvp-${invite.rsvpStatus}`} data-testid={`status-rsvp-${invite.id}`}>
                  {rsvpStatusLabels[invite.rsvpStatus]}
                </span>
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
                <button
                  className="button button-outline button-small"
                  data-testid={`button-edit-invite-${invite.id}`}
                  type="button"
                  onClick={() => openEditor(invite)}
                >
                  <PencilLine size={11} />
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Dialog open={Boolean(editingInvite)} onOpenChange={(open) => {
        if (!open) {
          closeEditor();
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit guest</DialogTitle>
            <DialogDescription>Update the invite details or remove this guest from the list.</DialogDescription>
          </DialogHeader>

          <div className="form-body" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="edit-guest-name">Guest name</label>
              <input
                id="edit-guest-name"
                autoComplete="name"
                className={formErrors.fullName ? 'invalid' : ''}
                maxLength={120}
                value={formValues.fullName}
                onChange={(event) => updateForm('fullName', event.target.value)}
                aria-invalid={Boolean(formErrors.fullName)}
              />
              {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
            </div>

            <div className="field">
              <label htmlFor="edit-guest-count">Number of guests</label>
              <div className="guest-stepper" id="edit-guest-count">
                <button
                  className="stepper-button"
                  type="button"
                  aria-label="Remove one guest"
                  disabled={formValues.numberOfGuests <= 1}
                  onClick={() => updateForm('numberOfGuests', Math.max(1, formValues.numberOfGuests - 1))}
                >
                  <Minus size={15} />
                </button>
                <div className="guest-count" aria-live="polite">
                  <strong>{formValues.numberOfGuests}</strong>
                  <span>{formValues.numberOfGuests === 1 ? 'guest' : 'guests'}</span>
                </div>
                <button
                  className="stepper-button"
                  type="button"
                  aria-label="Add one guest"
                  disabled={formValues.numberOfGuests >= 20}
                  onClick={() => updateForm('numberOfGuests', Math.min(20, formValues.numberOfGuests + 1))}
                >
                  <Plus size={15} />
                </button>
              </div>
              {formErrors.numberOfGuests && <span className="field-error">{formErrors.numberOfGuests}</span>}
            </div>

            <div className="field">
              <label htmlFor="edit-guest-phone">Phone number</label>
              <input
                id="edit-guest-phone"
                autoComplete="tel"
                className={formErrors.phoneNumber ? 'invalid' : ''}
                maxLength={30}
                type="tel"
                value={formValues.phoneNumber}
                onChange={(event) => updateForm('phoneNumber', event.target.value)}
                aria-invalid={Boolean(formErrors.phoneNumber)}
              />
              {formErrors.phoneNumber && <span className="field-error">{formErrors.phoneNumber}</span>}
            </div>

            <div className="field">
              <label htmlFor="edit-guest-email">Email address</label>
              <input
                id="edit-guest-email"
                autoComplete="email"
                className={formErrors.email ? 'invalid' : ''}
                maxLength={254}
                type="email"
                value={formValues.email}
                onChange={(event) => updateForm('email', event.target.value)}
                aria-invalid={Boolean(formErrors.email)}
              />
              {formErrors.email && <span className="field-error">{formErrors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="edit-guest-rsvp">RSVP status</label>
              <select
                id="edit-guest-rsvp"
                value={formValues.rsvpStatus}
                onChange={(event) => {
                  if (isRsvpStatus(event.target.value)) {
                    updateForm('rsvpStatus', event.target.value);
                  }
                }}
              >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>

          <DialogFooter className="sm:justify-between" style={{ marginTop: 10 }}>
            <button
              className="button"
              type="button"
              style={{ background: '#b93c3c', color: '#fff' }}
              onClick={submitDelete}
              disabled={deleteInvite.isPending}
            >
              <Trash2 size={12} />
              {deleteInvite.isPending ? 'Removing…' : 'Remove guest'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="button button-outline" type="button" onClick={closeEditor}>Cancel</button>
              <button className="button button-primary" type="button" onClick={submitUpdate} disabled={updateInvite.isPending}>
                {updateInvite.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
