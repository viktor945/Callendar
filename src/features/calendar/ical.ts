import type { DateEvent } from '../../model';

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
// RFC 5545 folds by UTF-8 octets, without splitting a Unicode character.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '', current = '', bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += current + '\r\n'; current = ' '; bytes = 1; }
    current += character; bytes += length;
  }
  return result + current;
}
export function calendarFile(events: DateEvent[], now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vdvoem//Shared Calendar//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Вдвоём', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const event of events.filter(event => event.status === 'planned')) {
    const day = event.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${escape(event.id)}@vdvoem`, `SEQUENCE:${event.version || 1}`, `DTSTAMP:${stamp}`);
    if (event.time) {
      // Floating local time follows the calendar's time zone, like the app's date/time fields.
      lines.push(`DTSTART:${day}T${event.time.replace(':', '')}00`, 'DURATION:PT1H');
    } else {
      const end = new Date(`${event.date}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${escape(event.kind === 'intimacy' ? 'Время для двоих' : event.title)}`, 'CLASS:PRIVATE', 'TRANSP:OPAQUE', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Запланирована встреча', `TRIGGER:${event.time ? '-PT1H' : 'PT9H'}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
