import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
global.WebSocket = class {};
import { getCalendarCredentials } from '../lib/google-calendar.ts';

async function main() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`Calling getCalendarCredentials for tenant ${tenantId}...`);
  const creds = await getCalendarCredentials(tenantId);
  console.log("Credentials result:", creds);
}

main().catch(console.error);
