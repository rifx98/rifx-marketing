import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getCalendarCredentials } from '../lib/google-calendar.js';

async function test() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`Testing getCalendarCredentials for tenant ${tenantId}...`);
  try {
    const creds = await getCalendarCredentials(tenantId);
    console.log("Credentials retrieved:", !!creds);
    if (creds) {
      console.log("Access Token length:", creds.access_token?.length);
      console.log("Refresh Token length:", creds.refresh_token?.length);
    }
  } catch (err) {
    console.error("Error retrieving credentials:", err);
  }
}

test();
