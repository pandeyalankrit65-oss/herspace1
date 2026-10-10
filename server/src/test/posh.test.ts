import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { annualReport, compositionProblems, deadlines, nextDue, type IcMember, type PoshCase } from '../posh';

const open = (receivedOn: string, more: Partial<PoshCase> = {}): PoshCase => ({
  receivedOn,
  conciliation: false,
  noticeSentOn: null,
  replyReceivedOn: null,
  inquiryCompletedOn: null,
  reportSubmittedOn: null,
  actionTakenOn: null,
  action: null,
  closedOn: null,
  ...more,
});

describe('POSH deadlines', () => {
  test('each step counts from the one before it', () => {
    const d = deadlines(open('2026-01-10', { noticeSentOn: '2026-01-14', inquiryCompletedOn: '2026-03-20', reportSubmittedOn: '2026-03-25' }));
    assert.deepEqual(d, { noticeBy: '2026-01-17', replyBy: '2026-01-24', inquiryBy: '2026-04-10', reportBy: '2026-03-30', actionBy: '2026-05-24' });
  });

  test('what is due next, and when it is late', () => {
    assert.deepEqual(nextDue(open('2026-01-10'), '2026-01-15'), { step: 'notice', by: '2026-01-17', overdue: false, daysLeft: 2 });
    assert.equal(nextDue(open('2026-01-10'), '2026-01-20')?.overdue, true);
    assert.equal(nextDue(open('2026-01-10', { noticeSentOn: '2026-01-12' }), '2026-01-15')?.step, 'reply');
    assert.equal(nextDue(open('2026-01-10', { noticeSentOn: '2026-01-12', replyReceivedOn: '2026-01-20' }), '2026-04-15')?.overdue, true);
    assert.equal(nextDue(open('2026-01-10', { noticeSentOn: '2026-01-12', replyReceivedOn: '2026-01-20', inquiryCompletedOn: '2026-03-01' }), '2026-03-05')?.step, 'report');
    assert.equal(nextDue(open('2026-01-10', { closedOn: '2026-02-01' }), '2026-12-01'), null);
  });

  test('conciliation has no inquiry clock', () => {
    assert.equal(nextDue(open('2026-01-10', { conciliation: true }), '2026-06-01'), null);
  });
});

describe('Internal Committee composition', () => {
  const member = (name: string, role: IcMember['role'], woman: boolean, termEnd = '2027-12-31'): IcMember => ({ name, role, woman, termStart: '2025-01-01', termEnd });

  test('a properly made committee has no problems', () => {
    const ic = [member('Asha', 'presiding', true), member('Ravi', 'employee', false), member('Meena', 'employee', true), member('Nita (NGO)', 'external', true)];
    assert.deepEqual(compositionProblems(ic, '2026-10-10'), []);
  });

  test('missing roles, a man presiding, too few women, and terms', () => {
    const ic = [member('Raj', 'presiding', false), member('Vikram', 'employee', false, '2026-11-01'), member('Old', 'employee', false, '2026-01-01')];
    const problems = compositionProblems(ic, '2026-10-10').map((p) => p.problem + (p.name ? `:${p.name}` : ''));
    assert.deepEqual(problems.sort(), ['no_external', 'presiding_not_woman:Raj', 'term_ended:Old', 'term_ending:Vikram', 'under_half_women'].sort());
    assert.deepEqual(compositionProblems([], '2026-10-10').map((p) => p.problem), ['no_presiding', 'few_employee_members', 'no_external']);
    assert.deepEqual(
      compositionProblems([{ ...member('Long', 'external', true), termStart: '2025-01-01', termEnd: '2029-06-01' }], '2026-10-10').map((p) => p.problem),
      ['no_presiding', 'few_employee_members', 'term_over_3_years']
    );
  });
});

test('the annual report counts the calendar year (Rule 14)', () => {
  const cases = [
    open('2025-11-01', { closedOn: '2026-01-15', action: 'warning', actionTakenOn: '2026-01-10' }),
    open('2026-02-01', { closedOn: '2026-04-01', action: 'not_proved', actionTakenOn: '2026-03-30' }),
    open('2026-08-01'), // open at year end, 152 days
    open('2026-11-20'), // open at year end, 41 days
    open('2027-01-05'),
  ];
  assert.deepEqual(annualReport(cases, 2026, 3), {
    year: 2026,
    received: 3,
    disposed: 2,
    pendingOver90Days: 1,
    workshops: 3,
    actions: { warning: 1, not_proved: 1 },
  });
});
