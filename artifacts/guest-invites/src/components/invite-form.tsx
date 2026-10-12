'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateInvite, getListInvitesQueryKey, getGetInviteSummaryQueryKey } from '@workspace/api-client-react';
import type { Invite, InviteInput } from '@workspace/api-client-react';
import { LoaderCircle, Plus, UserRoundPlus, Minus } from 'lucide-react';

type InviteFormProps = {
  onCreated: (invite: Invite) => void;
};

type FieldErrors = Partial<Record<keyof InviteInput, string>>;

const initialValues: InviteInput = {
  fullName: '',
  numberOfGuests: 1,
  phoneNumber: '',
  email: '',
};

export function InviteForm({ onCreated }: InviteFormProps) {
  const queryClient = useQueryClient();
  const createInvite = useCreateInvite();
  const [values, setValues] = useState<InviteInput>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate() {
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

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function update<K extends keyof InviteInput>(key: K, value: InviteInput[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate() || createInvite.isPending) {
      return;
    }

    createInvite.mutate(
      {
        data: {
          fullName: values.fullName.trim(),
          numberOfGuests: values.numberOfGuests,
          phoneNumber: values.phoneNumber.trim(),
          email: values.email.trim(),
        },
      },
      {
        onSuccess: (invite) => {
          void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
          setValues(initialValues);
          setErrors({});
          onCreated(invite);
        },
      },
    );
  }

  return (
    <section className="panel form-panel" aria-labelledby="create-heading">
      <div className="panel-header">
        <div>
          <h2 id="create-heading">Create an invite</h2>
          <p>One ticket, ready to send.</p>
        </div>
        <div className="empty-icon" style={{ width: 34, height: 34, margin: 0, borderRadius: 11 }}>
          <UserRoundPlus size={16} />
        </div>
      </div>

      <form className="form-body" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="guest-name">Guest name</label>
          <input
            id="guest-name"
            autoComplete="name"
            required
            className={errors.fullName ? 'invalid' : ''}
            data-testid="input-guest-name"
            maxLength={120}
            placeholder="e.g. Alex Morgan"
            value={values.fullName}
            onChange={(event) => update('fullName', event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'guest-name-error' : undefined}
          />
          {errors.fullName && <span className="field-error" id="guest-name-error">{errors.fullName}</span>}
        </div>

        <div className="field">
          <label htmlFor="guest-count">Number of guests</label>
          <div className="guest-stepper" id="guest-count">
            <button
              className="stepper-button"
              data-testid="button-decrease-guests"
              type="button"
              aria-label="Remove one guest"
              disabled={values.numberOfGuests <= 1}
              onClick={() => update('numberOfGuests', Math.max(1, values.numberOfGuests - 1))}
            >
              <Minus size={15} />
            </button>
            <div className="guest-count" aria-live="polite">
              <strong>{values.numberOfGuests}</strong>
              <span>{values.numberOfGuests === 1 ? 'guest' : 'guests'}</span>
            </div>
            <button
              className="stepper-button"
              data-testid="button-increase-guests"
              type="button"
              aria-label="Add one guest"
              disabled={values.numberOfGuests >= 20}
              onClick={() => update('numberOfGuests', Math.min(20, values.numberOfGuests + 1))}
            >
              <Plus size={15} />
            </button>
          </div>
          <span className="field-hint">One ticket admits this many people (up to 20).</span>
          {errors.numberOfGuests && <span className="field-error">{errors.numberOfGuests}</span>}
        </div>

        <div className="field">
          <label htmlFor="guest-phone">Phone number</label>
          <input
            id="guest-phone"
            autoComplete="tel"
            className={errors.phoneNumber ? 'invalid' : ''}
            data-testid="input-guest-phone"
            maxLength={30}
            placeholder="+1 (555) 014-0238"
            type="tel"
            required
            value={values.phoneNumber}
            onChange={(event) => update('phoneNumber', event.target.value)}
            aria-invalid={Boolean(errors.phoneNumber)}
          />
          {errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
        </div>

        <div className="field">
          <label htmlFor="guest-email">Email address</label>
          <input
            id="guest-email"
            autoComplete="email"
            required
            className={errors.email ? 'invalid' : ''}
            data-testid="input-guest-email"
            maxLength={254}
            placeholder="alex@example.com"
            type="email"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        {createInvite.isError && (
          <div className="scan-error" role="alert">
            The invite could not be created. Check your connection and try again.
          </div>
        )}

        <button
          className="button button-primary button-wide"
          data-testid="button-create-invite"
          type="submit"
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
          {createInvite.isPending ? 'Creating ticket…' : 'Create invite'}
        </button>
      </form>
    </section>
  );
}
