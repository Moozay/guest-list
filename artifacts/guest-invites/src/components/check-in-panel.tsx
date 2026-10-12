'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetInviteQueryKey,
  getGetInviteSummaryQueryKey,
  getListInvitesQueryKey,
  useCheckInInvite,
  useGetInvite,
  useResolveInvite,
} from '@workspace/api-client-react';
import type { Invite, InviteScanResult } from '@workspace/api-client-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

function formatArrival(value: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Arrival recorded';
  }
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try scanning again.';
}

export function CheckInPanel() {
  const queryClient = useQueryClient();
  const resolveInvite = useResolveInvite();
  const checkInInvite = useCheckInInvite();
  const [scanResult, setScanResult] = useState<InviteScanResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fileError, setFileError] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const [lookupId, setLookupId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasProcessedRef = useRef(false);

  const inviteQuery = useGetInvite(lookupId, {
    query: {
      enabled: Boolean(lookupId),
      queryKey: getGetInviteQueryKey(lookupId),
    },
  });

  const invite = scanResult?.invite ?? inviteQuery.data ?? null;

  function handleResolve(payload: string) {
    hasProcessedRef.current = true;
    setCameraActive(false);
    setCameraError('');
    setFileError('');
    setCheckInError('');
    setScanResult(null);
    setLookupId('');

    resolveInvite.mutate(
      { data: { qrPayload: payload } },
      {
        onSuccess: (result) => {
          setScanResult(result);
          if (result.invite) {
            setLookupId(result.invite.id);
          }
        },
      },
    );
  }

  useEffect(() => {
    if (!cameraActive) {
      return;
    }

    let cancelled = false;
    const scanner = new Html5Qrcode('guest-invite-camera', { verbose: false });
    scannerRef.current = scanner;

    void scanner
      .start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
        (decodedText) => {
          if (!hasProcessedRef.current) {
            handleResolve(decodedText);
          }
        },
        () => undefined,
      )
      .then(() => {
        if (cancelled) {
          void scanner.stop().catch(() => undefined);
          return;
        }
        setCameraError('');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCameraActive(false);
          setCameraError(errorMessage(error));
        }
      });

    return () => {
      cancelled = true;
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
      void scanner
        .stop()
        .catch(() => undefined)
        .then(() => {
          scanner.clear();
        });
    };
  }, [cameraActive]);

  function beginCamera() {
    setFileError('');
    setCameraError('');
    setScanResult(null);
    setLookupId('');
    hasProcessedRef.current = false;
    setCameraActive(true);
  }

  async function scanImage(file: File) {
    if (!file) {
      return;
    }
    setFileError('');
    setCameraError('');
    setScanResult(null);
    setLookupId('');
    hasProcessedRef.current = false;

    const imageScanner = new Html5Qrcode('guest-invite-camera', { verbose: false });
    try {
      const decodedText = await imageScanner.scanFile(file, true);
      handleResolve(decodedText);
    } catch {
      setFileError('No readable QR code found in that image. Choose a clearer image and try again.');
    } finally {
      imageScanner.clear();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function markArrived() {
    if (!invite || !scanResult || scanResult.status !== 'valid' || invite.arrivedAt) {
      return;
    }
    setCheckInError('');
    checkInInvite.mutate(
      { id: invite.id },
      {
        onSuccess: (result) => {
          const nextInvite = result.invite;
          const nextStatus = result.alreadyCheckedIn ? 'already_checked_in' : 'valid';
          setScanResult({
            status: nextStatus,
            invite: nextInvite,
          });
          setLookupId(nextInvite.id);
          void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetInviteSummaryQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetInviteQueryKey(nextInvite.id) });
        },
        onError: (error) => {
          setCheckInError(errorMessage(error));
        },
      },
    );
  }

  function resetResult() {
    setScanResult(null);
    setLookupId('');
    setFileError('');
    setCameraError('');
    setCheckInError('');
    hasProcessedRef.current = false;
  }

  return (
    <section className="scan-layout" aria-label="Guest check-in">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Scan a ticket</h2>
            <p>Point the camera at the guest’s QR code.</p>
          </div>
          <span className="count-chip">DOOR SCANNER</span>
        </div>

        <div className="scanner-wrap">
          <div className={`scanner-frame${cameraActive ? ' camera-active-frame' : ''}`}>
            <div
              id="guest-invite-camera"
              aria-label="Camera QR scanner"
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            {!cameraActive && (
              <div className="scanner-placeholder">
                <div className="scan-reticle">
                  <QrCode size={45} strokeWidth={1.35} />
                </div>
                <h3>Ready when you are</h3>
                <p>Scan a guest’s ticket to confirm their invite and see who’s with them.</p>
              </div>
            )}
          </div>

          <div className="scanner-actions">
            {!cameraActive ? (
              <button
                className="button button-dark"
                data-testid="button-start-camera"
                type="button"
                onClick={beginCamera}
              >
                <Camera size={15} />
                Start camera
              </button>
            ) : (
              <button
                className="button button-outline"
                data-testid="button-stop-camera"
                type="button"
                onClick={() => setCameraActive(false)}
              >
                <RotateCcw size={15} />
                Close camera
              </button>
            )}
            <button
              className="button button-outline"
              data-testid="button-upload-qr"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={resolveInvite.isPending || cameraActive}
            >
              <ImagePlus size={15} />
              Scan from image
            </button>
            <input
              ref={fileInputRef}
              className="hidden-file"
              data-testid="input-qr-image"
              type="file"
              accept="image/*"
              aria-label="Choose an image containing an invite QR code"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void scanImage(file);
                }
              }}
            />
          </div>

          {(cameraError || fileError) && (
            <div className="scan-error" role="alert">
              {cameraError && <>Camera unavailable: {cameraError} You can still choose a QR image.</>}
              {fileError}
            </div>
          )}

          <div className="scan-tip">
            <ShieldCheck size={15} />
            Invite codes are checked against your live guest list. No guesswork at the door.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Guest details</h2>
            <p>Ticket status appears as soon as it’s read.</p>
          </div>
          {(scanResult || resolveInvite.isPending) && (
            <button className="button button-quiet button-small" type="button" onClick={resetResult}>
              Clear
            </button>
          )}
        </div>

        <div className="scan-result-card" aria-live="polite">
          {resolveInvite.isPending && (
            <div className="result-empty" data-testid="loading-scan-result">
              <LoaderCircle className="spin" size={25} />
              <p>Checking that invite…</p>
            </div>
          )}

          {!resolveInvite.isPending && resolveInvite.isError && (
            <div className="result-banner invalid" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>Couldn’t check this ticket</strong>
                <span>Check your connection and scan again.</span>
              </div>
            </div>
          )}

          {!resolveInvite.isPending && !resolveInvite.isError && !scanResult && (
            <div className="result-empty">
              <ScanLine size={28} strokeWidth={1.5} />
              <p>Guest name, party size, and arrival status will show here after a scan.</p>
            </div>
          )}

          {!resolveInvite.isPending && scanResult?.status === 'not_valid' && (
            <div className="result-banner invalid" data-testid="status-invalid-invite">
              <AlertCircle size={18} />
              <div>
                <strong>Not a valid invite</strong>
                <span>This code isn’t on the guest list. Ask the host to confirm the ticket.</span>
              </div>
            </div>
          )}

          {!resolveInvite.isPending && scanResult?.status === 'valid' && invite && (
            <>
              <div className="result-banner">
                <CheckCircle2 size={19} />
                <div>
                  <strong>{invite.arrivedAt ? 'Already checked in' : 'Invite verified'}</strong>
                  <span>{invite.arrivedAt ? 'This guest has already arrived.' : 'This ticket is valid and ready.'}</span>
                </div>
              </div>
              <GuestDetails invite={invite} />
              {invite.arrivedAt ? (
                <p className="arrival-time" data-testid="text-arrival-time">
                  Arrived at {formatArrival(invite.arrivedAt)}
                </p>
              ) : (
                <button
                  className="button button-primary button-wide"
                  data-testid="button-mark-arrived"
                  type="button"
                  onClick={markArrived}
                  disabled={checkInInvite.isPending}
                >
                  {checkInInvite.isPending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
                  {checkInInvite.isPending ? 'Marking arrived…' : 'Mark as arrived'}
                </button>
              )}
              {checkInError && <p className="scan-error" role="alert">{checkInError}</p>}
            </>
          )}

          {!resolveInvite.isPending && scanResult?.status === 'already_checked_in' && invite && (
            <>
              <div className="result-banner already" data-testid="status-already-arrived">
                <Clock3 size={18} />
                <div>
                  <strong>Already checked in</strong>
                  <span>This ticket has been used at the door.</span>
                </div>
              </div>
              <GuestDetails invite={invite} />
              <p className="arrival-time" data-testid="text-arrival-time">
                Arrived at {formatArrival(invite.arrivedAt)}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function GuestDetails({ invite }: { invite: Invite }) {
  return (
    <div className="guest-detail" data-testid={`card-scanned-invite-${invite.id}`}>
      <h3 className="guest-detail-name">{invite.fullName}</h3>
      <div className="guest-detail-meta">
        {invite.numberOfGuests} {invite.numberOfGuests === 1 ? 'guest' : 'guests'} on this ticket
      </div>
      <div className="guest-info-grid">
        <div>
          <div className="guest-info-label">Invite code</div>
          <div className="guest-info-value code-value">{invite.inviteCode}</div>
        </div>
        <div>
          <div className="guest-info-label">Phone</div>
          <div className="guest-info-value">{invite.phoneNumber}</div>
        </div>
        {invite.email && (
          <div>
            <div className="guest-info-label">Email</div>
            <div className="guest-info-value">{invite.email}</div>
          </div>
        )}
        <div>
          <div className="guest-info-label">Party size</div>
          <div className="guest-info-value">
            <UsersRound size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            {invite.numberOfGuests}
          </div>
        </div>
      </div>
    </div>
  );
}
