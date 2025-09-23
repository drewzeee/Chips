#!/usr/bin/env tsx
import fetch from 'node-fetch';
import { writeFileSync, readFileSync, existsSync } from 'fs';

interface AuthSession {
  cookies: string;
  expires: number;
  userId?: string;
}

const SESSION_FILE = './.session-cache';

function saveSession(cookies: string, userId?: string): void {
  const session: AuthSession = {
    cookies,
    expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    userId
  };
  writeFileSync(SESSION_FILE, JSON.stringify(session));
}

function loadSession(): AuthSession | null {
  if (!existsSync(SESSION_FILE)) {
    return null;
  }

  try {
    const session: AuthSession = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));

    if (session.expires <= Date.now()) {
      console.log('🔄 Cached session expired');
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

async function login(email: string, password: string, apiUrl: string): Promise<string> {
  console.log('🔐 Logging in...');

  // Get CSRF token first
  const csrfResponse = await fetch(`${apiUrl}/api/auth/csrf`);
  const csrfData = await csrfResponse.json() as { csrfToken: string };

  const csrfCookies = csrfResponse.headers.get('set-cookie') || '';

  // Login
  const loginResponse = await fetch(`${apiUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': csrfCookies,
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken: csrfData.csrfToken,
      callbackUrl: `${apiUrl}/dashboard`,
      json: 'true'
    }),
    redirect: 'manual'
  });

  const sessionCookies = loginResponse.headers.get('set-cookie') || '';

  if (!sessionCookies.includes('next-auth.session-token') && !sessionCookies.includes('__Secure-next-auth.session-token')) {
    throw new Error('Login failed - no session cookie received');
  }

  // Test the session by making an authenticated request
  const testResponse = await fetch(`${apiUrl}/api/accounts`, {
    headers: {
      'Cookie': sessionCookies
    }
  });

  if (!testResponse.ok) {
    throw new Error(`Login validation failed: ${testResponse.status}`);
  }

  console.log('✅ Login successful!');

  // Save session
  saveSession(sessionCookies);

  return sessionCookies;
}

export async function getAuthenticatedSession(apiUrl: string = 'http://localhost:3000'): Promise<string> {
  // Try cached session first
  const cached = loadSession();
  if (cached) {
    console.log('🔓 Using cached session');

    // Verify session is still valid
    const testResponse = await fetch(`${apiUrl}/api/accounts`, {
      headers: {
        'Cookie': cached.cookies
      }
    });

    if (testResponse.ok) {
      return cached.cookies;
    } else {
      console.log('🔄 Cached session invalid, need to re-login');
    }
  }

  // Need to login
  const email = process.env.LOGIN_EMAIL;
  const password = process.env.LOGIN_PASSWORD;

  if (!email || !password) {
    throw new Error(`
❌ Authentication required! Set environment variables:
   export LOGIN_EMAIL="your@email.com"
   export LOGIN_PASSWORD="yourpassword"

Or use the interactive login:
   tsx auth-helper.ts login
`);
  }

  return await login(email, password, apiUrl);
}

async function interactiveLogin(): Promise<void> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    const apiUrl = await question('API URL (default: http://localhost:3000): ') || 'http://localhost:3000';
    const email = await question('Email: ');

    // Hide password input
    process.stdout.write('Password: ');
    process.stdin.setRawMode(true);

    let password = '';
    for await (const chunk of process.stdin) {
      const char = chunk.toString();
      if (char === '\r' || char === '\n') {
        break;
      } else if (char === '\x7f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (char >= ' ' && char <= '~') {
        password += char;
        process.stdout.write('*');
      }
    }

    process.stdin.setRawMode(false);
    console.log('');

    const cookies = await login(email, password, apiUrl);
    console.log('🎉 Session saved! You can now run the import scripts.');

  } catch (error) {
    console.error('❌ Login failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function showStatus(): Promise<void> {
  const session = loadSession();

  if (!session) {
    console.log('❌ No cached session found');
    return;
  }

  const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  console.log('📋 Session Status:');
  console.log(`   Expires: ${new Date(session.expires).toLocaleString()}`);
  console.log(`   Valid: ${session.expires > Date.now() ? '✅' : '❌'}`);

  // Test session
  try {
    const testResponse = await fetch(`${apiUrl}/api/accounts`, {
      headers: {
        'Cookie': session.cookies
      }
    });

    if (testResponse.ok) {
      const accounts = await testResponse.json();
      console.log(`   API Test: ✅ (${accounts.length} accounts found)`);
    } else {
      console.log(`   API Test: ❌ (${testResponse.status})`);
    }
  } catch (error) {
    console.log(`   API Test: ❌ (${error})`);
  }
}

async function clearSession(): Promise<void> {
  if (existsSync(SESSION_FILE)) {
    require('fs').unlinkSync(SESSION_FILE);
    console.log('✅ Session cache cleared');
  } else {
    console.log('ℹ️  No session cache to clear');
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'login':
      await interactiveLogin();
      break;
    case 'status':
      await showStatus();
      break;
    case 'clear':
      await clearSession();
      break;
    case 'test':
      try {
        const cookies = await getAuthenticatedSession();
        console.log('✅ Authentication working!');
      } catch (error) {
        console.error('❌ Authentication failed:', error);
      }
      break;
    case 'help':
      console.log('Authentication Helper');
      console.log('====================');
      console.log('Usage: tsx auth-helper.ts [command]');
      console.log('');
      console.log('Commands:');
      console.log('  login   - Interactive login (saves session)');
      console.log('  status  - Show current session status');
      console.log('  test    - Test authentication');
      console.log('  clear   - Clear cached session');
      console.log('  help    - Show this help');
      console.log('');
      console.log('Environment Variables:');
      console.log('  LOGIN_EMAIL    - Your login email');
      console.log('  LOGIN_PASSWORD - Your login password');
      console.log('  API_BASE_URL   - API URL (default: http://localhost:3000)');
      break;
    default:
      console.log('Use "tsx auth-helper.ts help" for usage information');
  }
}

if (require.main === module) {
  main().catch(console.error);
}