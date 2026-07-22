import { describe, expect, it } from 'vitest';
import { canUseBusinessMail } from './BusinessMail';

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
