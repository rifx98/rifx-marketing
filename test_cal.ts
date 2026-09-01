import 'dotenv/config';
import { getCalendarCredentials, createCalendarEvent } from './lib/google-calendar.js';

async function test() {
  try {
    const creds = await getCalendarCredentials('26db5d82-84e2-4af5-9458-add284631021');
    console.log('Creds OK:', !!creds);
    const eventResult = await createCalendarEvent('26db5d82-84e2-4af5-9458-add284631021', {
      summary: 'Test Event',
      description: 'Test',
      startDateTime: '2026-09-08T15:00:00-05:00',
      endDateTime: '2026-09-08T16:00:00-05:00',
      timeZone: 'America/Guayaquil'
    });
    console.log('Event result:', eventResult);
  } catch (err) {
    console.error('ERROR:', err);
  }
}
test();
