import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// lambda/ is CommonJS (its own package.json has no "type"), while this package
// is ESM. createRequire loads it the way the Lambda runtime does. The module is
// pure and dependency-free, so nothing from the AWS SDK is pulled in.
const require = createRequire(import.meta.url);
const { buildAccessEmail, escapeHtml } = require(resolve(process.cwd(), 'lambda/lib/emails.js'));

const BASE = {
  email: 'alice@example.com',
  tempPassword: 'Tempp4ss!wordXY',
  signInUrl: 'https://jaetill.com/',
};

describe('buildAccessEmail', () => {
  it.each(['invite', 'reminder'])('%s links the portal, not the Cognito domain', (variant) => {
    const { text, html } = buildAccessEmail({ ...BASE, variant });

    expect(html).toContain('href="https://jaetill.com/"');
    expect(text).toContain('https://jaetill.com/');

    // The regression that started all of this: the Cognito custom domain root
    // serves nothing, so it must never appear as a link target.
    expect(html).not.toContain('just.jaetill.com');
    expect(text).not.toContain('just.jaetill.com');
  });

  it.each(['invite', 'reminder'])('%s carries both credentials', (variant) => {
    const { text, html } = buildAccessEmail({ ...BASE, variant });
    for (const body of [text, html]) {
      expect(body).toContain(BASE.email);
      expect(body).toContain(BASE.tempPassword);
    }
  });

  it('uses distinct subjects so a reminder is not mistaken for a first invite', () => {
    const invite = buildAccessEmail({ ...BASE, variant: 'invite' });
    const reminder = buildAccessEmail({ ...BASE, variant: 'reminder' });

    expect(invite.subject).not.toBe(reminder.subject);
    expect(invite.subject).toMatch(/invited/i);
    expect(reminder.subject).toMatch(/reminder/i);
  });

  it('names granted apps, with readable joining', () => {
    const one = buildAccessEmail({ ...BASE, variant: 'invite', appNames: ['Game Night'] });
    expect(one.text).toContain('access to Game Night.');

    const many = buildAccessEmail({
      ...BASE,
      variant: 'invite',
      appNames: ['Game Night', 'Carto', 'Meal Planner'],
    });
    expect(many.text).toContain('access to Game Night, Carto and Meal Planner.');
  });

  it('omits the apps line entirely when none are given', () => {
    const { text, html } = buildAccessEmail({ ...BASE, variant: 'reminder' });
    expect(text).not.toMatch(/access to/);
    expect(html).not.toMatch(/access to/);
  });

  it('escapes HTML in interpolated values', () => {
    const { html } = buildAccessEmail({
      ...BASE,
      variant: 'invite',
      email: '"><script>alert(1)</script>@example.com',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('leaves the plain-text body unescaped', () => {
    // Temp passwords come from a set including & and < is not in it, but the
    // generator's symbol set does include characters that would be mangled if
    // the text body were HTML-escaped.
    const { text } = buildAccessEmail({ ...BASE, variant: 'invite', tempPassword: 'a&b<c>d' });
    expect(text).toContain('a&b<c>d');
  });

  it('rejects an unknown variant rather than sending a blank email', () => {
    expect(() => buildAccessEmail({ ...BASE, variant: 'nope' })).toThrow(/unknown email variant/i);
  });
});

describe('escapeHtml', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
