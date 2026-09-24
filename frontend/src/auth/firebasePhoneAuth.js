const FIREBASE_VERSION = '12.19.0';

let sdkPromise;
let appInstance;
let authInstance;

function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  };
}

export function isFirebasePhoneConfigured() {
  const config = firebaseConfig();
  return Boolean(
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.appId
  );
}

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`)
    ]).then(([appSdk, authSdk]) => ({ appSdk, authSdk }));
  }
  return sdkPromise;
}

async function getFirebaseAuth() {
  if (!isFirebasePhoneConfigured()) {
    throw new Error('Firebase phone verification is not configured yet.');
  }

  const { appSdk, authSdk } = await loadSdk();

  if (!appInstance) {
    const config = firebaseConfig();
    appInstance = appSdk.getApps().length
      ? appSdk.getApp()
      : appSdk.initializeApp(config);
  }

  if (!authInstance) {
    authInstance = authSdk.getAuth(appInstance);
    authInstance.useDeviceLanguage();
  }

  return { auth: authInstance, authSdk };
}

export function normalizePhoneForFirebase(rawPhone) {
  if (!rawPhone || !rawPhone.trim()) {
    throw new Error('Please enter a valid phone number.');
  }

  let digits = rawPhone.trim()
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  if (!/^\d+$/.test(digits)) {
    throw new Error('Please enter a valid phone number.');
  }

  if (digits.length === 10) {
    digits = '91' + digits;
  }

  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Enter a valid phone number with country code.');
  }

  return '+' + digits;
}

export function maskFirebasePhone(phone) {
  if (!phone || phone.length <= 6) return phone || '';
  return phone.slice(0, 3) + '••••••' + phone.slice(-4);
}

export async function createFirebaseRecaptcha(containerId) {
  const { auth, authSdk } = await getFirebaseAuth();
  return new authSdk.RecaptchaVerifier(auth, containerId, {
    size: 'invisible'
  });
}

export async function sendFirebaseOtp(rawPhone, appVerifier) {
  const { auth, authSdk } = await getFirebaseAuth();
  const phone = normalizePhoneForFirebase(rawPhone);
  const confirmation = await authSdk.signInWithPhoneNumber(
    auth,
    phone,
    appVerifier
  );
  return { confirmation, phone };
}

export async function confirmFirebaseOtp(confirmation, code) {
  if (!confirmation) {
    throw new Error('Request a new verification code first.');
  }

  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken(true);
}

export async function signOutFirebase() {
  if (!authInstance) return;
  const { authSdk } = await loadSdk();
  await authSdk.signOut(authInstance);
}

export function firebaseAuthErrorMessage(error) {
  const code = error?.code || '';

  const messages = {
    'auth/invalid-phone-number': 'Enter a valid phone number.',
    'auth/missing-phone-number': 'Enter your phone number first.',
    'auth/too-many-requests': 'Too many verification attempts. Wait a while and try again.',
    'auth/quota-exceeded': 'Firebase SMS quota has been reached. Try again later.',
    'auth/captcha-check-failed': 'Security check failed. Please try again.',
    'auth/invalid-verification-code': 'That verification code is incorrect.',
    'auth/code-expired': 'That verification code has expired. Request a new one.',
    'auth/session-expired': 'That verification session expired. Request a new code.'
  };

  return messages[code] || error?.message || 'Phone verification failed. Please try again.';
}
