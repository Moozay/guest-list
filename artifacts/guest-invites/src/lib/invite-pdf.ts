import QRCode from 'qrcode';
import type { Invite } from '@workspace/api-client-react';

export function invitePdfFilename(fullName: string): string {
  const guestName = fullName
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_.-]/gu, '')
    .replace(/^[.-]+|[.-]+$/g, '') || 'guest';
  return `guest-invite-${guestName}.pdf`;
}

export async function createInvitePdf(invite: Invite, templateBytes: ArrayBuffer): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(templateBytes);
  const pages = pdf.getPages();
  if (pages.length < 2) {
    throw new Error('Invite PDF template must contain at least two pages.');
  }

  const qrDataUrl = await QRCode.toDataURL(`GUEST_INVITE_V1:${invite.id}`, {
    width: 400,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#202c38',
      light: '#ffffff',
    },
  });
  const qrBase64 = qrDataUrl.slice(qrDataUrl.indexOf(',') + 1);
  const qrBytes = Uint8Array.from(atob(qrBase64), (character) => character.charCodeAt(0));
  const qrImage = await pdf.embedPng(qrBytes);
  const page = pages[1];
  const { width, height } = page.getSize();
  const qrSize = Math.min(width, height) * 0.33;

  page.drawImage(qrImage, {
    x: (width - qrSize) / 2,
    y: (height - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  return pdf.save();
}
