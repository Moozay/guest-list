'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Invite } from '@workspace/api-client-react';
import { Download, LoaderCircle, TicketCheck, X } from 'lucide-react';

type TicketQrDialogProps = {
  invite: Invite;
  onClose: () => void;
};

export const invitePayload = (inviteId: string) => `GUEST_INVITE_V1:${inviteId}`;

export function TicketQrDialog({ invite, onClose }: TicketQrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setQrReady(false);
    setQrError('');

    if (!canvasRef.current) {
      return () => {
        cancelled = true;
      };
    }

    void QRCode.toCanvas(canvasRef.current, invitePayload(invite.id), {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#202c38',
        light: '#ffffff',
      },
    })
      .then(() => {
        if (!cancelled) {
          setQrReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError('This ticket code could not be generated. Please try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [invite.id]);

  async function downloadQrCode() {
    setDownloadPending(true);
    setQrError('');

    try {
      const qrDataUrl = await QRCode.toDataURL(invitePayload(invite.id), {
        width: 400,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#202c38',
          light: '#ffffff',
        },
      });

      const downloadLink = document.createElement('a');
      downloadLink.download = `guest-qr-${invite.inviteCode}.png`;
      downloadLink.href = qrDataUrl;
      downloadLink.click();
    } catch {
      setQrError('The QR code could not be downloaded. Please try again.');
    } finally {
      setDownloadPending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-title">
        <div className="ticket-top">
          <button className="modal-close" type="button" aria-label="Close ticket" onClick={onClose}>
            <X size={16} />
          </button>
          <div className="ticket-brand">
            <TicketCheck size={15} />
            GUEST INVITES
          </div>
          <h2 id="ticket-title">Your guest ticket</h2>
          <p>Show this code at the door for a quick check-in.</p>
        </div>
        <div className="ticket-content">
          <div className="qr-shell" aria-label={`QR ticket for ${invite.fullName}`}>
            <canvas ref={canvasRef} width={180} height={180} />
            {!qrReady && !qrError && <LoaderCircle className="spin" size={19} aria-label="Creating QR code" />}
          </div>
          <div className="ticket-code">{invite.inviteCode}</div>
          <div className="ticket-recipient">
            {invite.fullName} · {invite.numberOfGuests} {invite.numberOfGuests === 1 ? 'guest' : 'guests'}
          </div>
          {qrError && <p className="scan-error" role="alert">{qrError}</p>}
          <div className="ticket-actions">
            <button
              className="button button-primary"
              data-testid="button-download-ticket"
              type="button"
              onClick={downloadQrCode}
              disabled={!qrReady || downloadPending}
            >
              {downloadPending ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
              {downloadPending ? 'Preparing…' : 'Download QR code'}
            </button>
            <button className="button button-outline" type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </section>
    </div>
  );
}
