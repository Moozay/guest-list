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

  async function downloadTicket() {
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
      const qrImage = new Image();

      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error('Could not load the ticket code.'));
        qrImage.src = qrDataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 940;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Ticket image is not available.');
      }

      context.fillStyle = '#f7f4ec';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#253640';
      context.fillRect(0, 0, canvas.width, 250);
      context.fillStyle = '#dfc37f';
      context.font = '700 24px DM Sans, sans-serif';
      context.fillText('GUEST INVITES', 54, 66);
      context.fillStyle = '#f8f5ed';
      context.font = '800 48px Manrope, sans-serif';
      context.fillText('Your guest ticket', 54, 145);
      context.fillStyle = '#b8c4c3';
      context.font = '400 21px DM Sans, sans-serif';
      context.fillText('The door, sorted.', 56, 191);
      context.fillStyle = '#263641';
      context.font = '800 37px Manrope, sans-serif';
      context.fillText(invite.fullName, 54, 325);
      context.fillStyle = '#78858b';
      context.font = '400 22px DM Sans, sans-serif';
      context.fillText(`${invite.numberOfGuests} ${invite.numberOfGuests === 1 ? 'guest' : 'guests'}`, 56, 367);
      context.fillStyle = '#fffefa';
      context.fillRect(155, 414, 410, 410);
      context.drawImage(qrImage, 160, 419, 400, 400);
      context.fillStyle = '#52616a';
      context.font = '500 21px DM Mono, monospace';
      context.textAlign = 'center';
      context.fillText(invite.inviteCode, 360, 872);
      context.fillStyle = '#879197';
      context.font = '400 17px DM Sans, sans-serif';
      context.fillText('Present this ticket at the door', 360, 906);

      const downloadLink = document.createElement('a');
      downloadLink.download = `guest-ticket-${invite.inviteCode}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    } catch {
      setQrError('The ticket image could not be downloaded. Please try again.');
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
              onClick={downloadTicket}
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
