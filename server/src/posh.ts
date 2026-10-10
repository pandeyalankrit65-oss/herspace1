// The POSH Act, 2013 (Sexual Harassment of Women at Workplace (Prevention, Prohibition and
// Redressal) Act) and its 2013 Rules, as the Internal Committee's tools apply them. A help for the
// committee, not legal advice: the sections are noted so they can be checked.

export const IC_ROLES = ['presiding', 'employee', 'external'] as const;
export type IcRole = (typeof IC_ROLES)[number];
export type IcMember = { name: string; role: IcRole; woman: boolean; termStart: string; termEnd: string };

export const ACTIONS = [
  'not_proved',
  'apology',
  'warning',
  'reprimand',
  'withhold_promotion',
  'counselling',
  'community_service',
  'termination',
  'other',
] as const;
export type Action = (typeof ACTIONS)[number];

export type PoshCase = {
  receivedOn: string;
  conciliation: boolean;
  noticeSentOn: string | null;
  replyReceivedOn: string | null;
  inquiryCompletedOn: string | null;
  reportSubmittedOn: string | null;
  actionTakenOn: string | null;
  action: Action | null;
  closedOn: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const parseDay = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
export const addDays = (d: string, days: number) => new Date(parseDay(d) + days * DAY).toISOString().slice(0, 10);

// The legal clock for one complaint. Each deadline counts from the step it follows.
export function deadlines(c: PoshCase) {
  return {
    // Rule 7(1): a copy of the complaint to the respondent within 7 working days; counted as 7 days here.
    noticeBy: addDays(c.receivedOn, 7),
    // Rule 7(2): the respondent replies within 10 days of receiving it.
    replyBy: c.noticeSentOn ? addDays(c.noticeSentOn, 10) : null,
    // Section 11(4): the inquiry is completed within 90 days.
    inquiryBy: addDays(c.receivedOn, 90),
    // Section 13(1): the committee's report to the employer within 10 days of completing it.
    reportBy: c.inquiryCompletedOn ? addDays(c.inquiryCompletedOn, 10) : null,
    // Section 13(4): the employer acts on the report within 60 days.
    actionBy: c.reportSubmittedOn ? addDays(c.reportSubmittedOn, 60) : null,
  };
}

export type Due = { step: 'notice' | 'reply' | 'inquiry' | 'report' | 'action'; by: string; overdue: boolean; daysLeft: number };

// What's next for an open case, and whether it's late. Conciliation (Section 10) settles a case
// without an inquiry, so it has no inquiry clock.
export function nextDue(c: PoshCase, today: string): Due | null {
  if (c.closedOn) return null;
  const d = deadlines(c);
  const due = (step: Due['step'], by: string | null): Due | null => {
    if (!by) return null;
    const daysLeft = Math.round((parseDay(by) - parseDay(today)) / DAY);
    return { step, by, overdue: daysLeft < 0, daysLeft };
  };
  if (!c.noticeSentOn && !c.conciliation) return due('notice', d.noticeBy);
  if (c.noticeSentOn && !c.replyReceivedOn && !c.conciliation) return due('reply', d.replyBy);
  if (!c.inquiryCompletedOn && !c.conciliation) return due('inquiry', d.inquiryBy);
  if (c.inquiryCompletedOn && !c.reportSubmittedOn) return due('report', d.reportBy);
  if (c.reportSubmittedOn && !c.actionTakenOn) return due('action', d.actionBy);
  return null;
}

export type CompositionProblem =
  | 'no_presiding'
  | 'many_presiding'
  | 'presiding_not_woman'
  | 'few_employee_members'
  | 'no_external'
  | 'under_half_women'
  | 'term_over_3_years'
  | 'term_ended'
  | 'term_ending';

// Section 4: a Presiding Officer (a woman employed at a senior level), at least two employee
// members, one external member, at least half of all members women, terms of up to three years.
export function compositionProblems(members: IcMember[], today: string): Array<{ problem: CompositionProblem; name?: string }> {
  const out: Array<{ problem: CompositionProblem; name?: string }> = [];
  const presiding = members.filter((m) => m.role === 'presiding');
  if (presiding.length === 0) out.push({ problem: 'no_presiding' });
  if (presiding.length > 1) out.push({ problem: 'many_presiding' });
  for (const p of presiding) if (!p.woman) out.push({ problem: 'presiding_not_woman', name: p.name });
  if (members.filter((m) => m.role === 'employee').length < 2) out.push({ problem: 'few_employee_members' });
  if (!members.some((m) => m.role === 'external')) out.push({ problem: 'no_external' });
  if (members.length && members.filter((m) => m.woman).length * 2 < members.length) out.push({ problem: 'under_half_women' });
  for (const m of members) {
    if (parseDay(m.termEnd) - parseDay(m.termStart) > 3 * 366 * DAY) out.push({ problem: 'term_over_3_years', name: m.name });
    const left = (parseDay(m.termEnd) - parseDay(today)) / DAY;
    if (left < 0) out.push({ problem: 'term_ended', name: m.name });
    else if (left <= 60) out.push({ problem: 'term_ending', name: m.name });
  }
  return out;
}

// Rule 14: the committee's annual report for a calendar year.
export function annualReport(cases: PoshCase[], year: number, workshops: number) {
  const inYear = (d: string | null) => Boolean(d && d.startsWith(`${year}-`));
  const yearEnd = `${year}-12-31`;
  const openAtYearEnd = cases.filter((c) => c.receivedOn <= yearEnd && (!c.closedOn || c.closedOn > yearEnd));
  const actions: Partial<Record<Action, number>> = {};
  for (const c of cases) if (c.action && inYear(c.actionTakenOn ?? c.closedOn)) actions[c.action] = (actions[c.action] ?? 0) + 1;
  return {
    year,
    received: cases.filter((c) => inYear(c.receivedOn)).length,
    disposed: cases.filter((c) => inYear(c.closedOn)).length,
    // Pending at the end of the year, more than 90 days after the complaint.
    pendingOver90Days: openAtYearEnd.filter((c) => parseDay(yearEnd) - parseDay(c.receivedOn) > 90 * DAY).length,
    workshops,
    actions,
  };
}
