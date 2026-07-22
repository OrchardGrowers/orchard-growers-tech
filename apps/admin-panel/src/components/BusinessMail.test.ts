import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BusinessMailHistoryRows,
  StatusBadge,
  buildBusinessMailLogParams,
  buildBusinessMailPreviewPayload,
  canUseBusinessMail,
  getBusinessMailStatusClass,
} from './BusinessMail';

describe('Business Mail UI authorization', () => {
  it.each(['SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE'])(
    'shows Business Mail for %s',
    (role) => expect(canUseBusinessMail(role)).toBe(true)
  );

  it.each(['EMPLOYEE', 'VIEWER', 'UNIT_MANAGER', 'VERIFICATION_OFFICER', '']) (
    'hides Business Mail for %s',
    (role) => expect(canUseBusinessMail(role)).toBe(false)
  );
});

describe('Business Mail signed preview and history helpers', () => {
  it('sends only the editable body and controlled sender key to preview', () => {
    const payload = buildBusinessMailPreviewPayload({
      senderProfileKey: 'EFRUITMANDI_NO_REPLY',
      to: 'recipient@example.test',
      category: 'GENERAL',
      subject: 'Hello',
      mode: 'text',
      text: 'Admin-authored body',
      html: '',
    });
    expect(payload).toEqual({ senderProfileKey: 'EFRUITMANDI_NO_REPLY', text: 'Admin-authored body' });
    expect(JSON.stringify(payload)).not.toContain('signature');
  });

  it('builds recipient and date history filters for the backend', () => {
    const params = buildBusinessMailLogParams(2, {
      status: 'SENT',
      provider: '',
      senderProfileKey: 'ORCHARD_NO_REPLY',
      recipient: 'person@example.test',
      category: '',
      fromDate: '2026-07-01',
      toDate: '2026-07-22',
    });
    expect(params.get('page')).toBe('2');
    expect(params.get('recipient')).toBe('person@example.test');
    expect(params.get('fromDate')).toBe('2026-07-01T00:00:00.000Z');
  });

  it('uses a safe fallback style for unknown status labels', () => {
    expect(getBusinessMailStatusClass('UNEXPECTED')).toContain('text-slate-300');
    const markup = renderToStaticMarkup(createElement(StatusBadge, { status: '<unsafe>' }));
    expect(markup).toContain('&lt;unsafe&gt;');
    expect(markup).not.toContain('<unsafe>');
  });

  it('renders sent records and loading/empty states without raw HTML interpretation', () => {
    const baseProps = { onView: () => undefined };
    expect(renderToStaticMarkup(createElement('table', null, createElement(BusinessMailHistoryRows, {
      ...baseProps,
      loading: true,
      logs: [],
    })))).toContain('Loading delivery history');
    expect(renderToStaticMarkup(createElement('table', null, createElement(BusinessMailHistoryRows, {
      ...baseProps,
      loading: false,
      logs: [],
    })))).toContain('No Business Mail deliveries found');
    const recordMarkup = renderToStaticMarkup(createElement('table', null, createElement(BusinessMailHistoryRows, {
      ...baseProps,
      loading: false,
      logs: [{
        id: 'log-1', category: 'GENERAL', senderProfileKey: 'EFRUITMANDI_NO_REPLY', senderName: 'eFruitMandi',
        senderEmail: 'no-reply@efruitmandi.live', replyTo: '', recipient: 'recipient@example.test',
        subject: '<img src=x onerror=alert(1)>', provider: 'brevo_api', providerMessageId: 'provider-1', status: 'SENT',
        requestedByAdmin: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' },
        failureCode: '', failureMessage: '', metadata: { source: '', correlationId: '' },
        createdAt: '2026-07-22T00:00:00.000Z', sentAt: '2026-07-22T00:00:01.000Z', failedAt: null,
      }],
    })));
    expect(recordMarkup).toContain('recipient@example.test');
    expect(recordMarkup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(recordMarkup).not.toContain('<img src=x');
  });
});
