export function isWithinDays(date: Date, days: number) {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - days);

  return date >= pastDate && date <= now;
}
