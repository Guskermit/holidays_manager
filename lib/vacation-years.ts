/**
 * Helpers for splitting vacation days across calendar years.
 *
 * Rule: a request whose start date falls in January of year N consumes the
 * remaining balance of year N-1 first, then year N.
 */

/** True when the vacation starts in January (any year). */
export function startsInJanuary(startDate: string): boolean {
  return new Date(startDate + "T00:00:00").getMonth() === 0;
}

export type YearSplit = {
  /** Days charged to the previous calendar year (year - 1). */
  prevYearDays: number;
  /** Days charged to the request's own year. */
  currentYearDays: number;
};

/**
 * Split `days` between the previous year and the request year.
 * `prevYearRemaining` is how many days are still available on year-1.
 */
export function splitJanuaryDays(days: number, prevYearRemaining: number): YearSplit {
  const prevYearDays = Math.min(Math.max(prevYearRemaining, 0), days);
  return {
    prevYearDays,
    currentYearDays: days - prevYearDays,
  };
}

/**
 * Days of a request that belong to a given balance year.
 *
 * - Normal request (prev_year_days = 0): all days belong to `req.year`.
 * - January split: `prev_year_days` belong to `req.year - 1`,
 *   the remainder belongs to `req.year`.
 */
export function daysInBalanceYear(
  req: {
    year: number;
    days_requested?: number | null;
    prev_year_days?: number | null;
    status?: string | null;
    is_bootcamp?: boolean | null;
    is_medical_leave?: boolean | null;
    is_other?: boolean | null;
  },
  balanceYear: number
): number {
  const days = req.days_requested ?? 0;
  const prevDays = req.prev_year_days ?? 0;

  if (req.year === balanceYear) {
    return Math.max(0, days - prevDays);
  }
  if (req.year === balanceYear + 1 && prevDays > 0) {
    return Math.min(prevDays, days);
  }
  return 0;
}

/** True if the request counts toward regular vacation balances. */
export function isRegularVacation(req: {
  is_bootcamp?: boolean | null;
  is_medical_leave?: boolean | null;
  is_other?: boolean | null;
}): boolean {
  return !req.is_bootcamp && !req.is_medical_leave && !req.is_other;
}
