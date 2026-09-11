/** Age in whole years from a YYYY-MM-DD date of birth. */
export function ageFromDob(dob: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [year, month, day] = dob.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (
    Number.isNaN(birth.getTime()) ||
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return null; // e.g. 2025-02-30
  }
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() < month - 1 ||
    (now.getMonth() === month - 1 && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}
