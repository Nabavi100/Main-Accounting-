import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Defined OAuth scopes for Google Drive
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Lazy Firebase App initialization
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory (do not use localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  isAuto?: boolean;
}

export interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number; // 60 = 1 hour, 360 = 6 hours, 720 = 12 hours, 1440 = 24 hours
  lastBackupTime: string | null;
  lastBackupFileName: string | null;
  lastBackupStatus: 'success' | 'error' | null;
  lastErrorText?: string;
  keepMaxBackups: number; // e.g. 15
}

const SETTINGS_KEY = 'HESABDAR_GDRIVE_AUTO_BACKUP_CONFIG';

export const getAutoBackupSettings = (): AutoBackupSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse auto backup settings:', e);
  }
  return {
    enabled: true,
    intervalMinutes: 360, // Every 6 hours
    lastBackupTime: null,
    lastBackupFileName: null,
    lastBackupStatus: null,
    keepMaxBackups: 15,
  };
};

export const saveAutoBackupSettings = (settings: AutoBackupSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save auto backup settings:', e);
  }
};

/**
 * Initialize auth state listener.
 */
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google Popup and obtain access token
 */
export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('عدم دریافت توکن دسترسی از گوگل. لطفاً مجدداً وارد شوید.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setDriveAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getCurrentDriveUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Find or create dedicated folder 'Hesabdar_Backups' in Google Drive
 */
export const getOrCreateBackupFolder = async (token: string): Promise<string> => {
  const query = encodeURIComponent(
    "name = 'Hesabdar_Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('توکن اتصال به گوگل منقضی شده است. لطفاً مجدداً دکمه ورود را بزنید.');
    }
    throw new Error(`خطای ارتباط با درایو (${res.status})`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Hesabdar_Backups',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'پوشه نگهداری نسخه‌های پشتیبان نرم‌افزار حسابداری و گدام‌داری',
    }),
  });

  if (!createRes.ok) {
    throw new Error('امکان ایجاد پوشه در گوگل درایو میسر نشد.');
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

/**
 * Upload JSON backup to Google Drive
 */
export const uploadBackupToDrive = async (
  token: string,
  jsonData: string,
  options?: {
    customName?: string;
    isAuto?: boolean;
    folderId?: string;
  }
): Promise<DriveBackupFile> => {
  const folderId = options?.folderId || (await getOrCreateBackupFolder(token));
  const isAuto = !!options?.isAuto;

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName =
    options?.customName ||
    `Hesabdar_${isAuto ? 'AutoBackup' : 'Backup'}_${dateStr}.json`;

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: isAuto
      ? 'نسخه پشتیبان خودکار سیستم حسابداری'
      : 'نسخه پشتیبان دستی سیستم حسابداری',
    properties: {
      app: 'hesabdar',
      type: isAuto ? 'auto' : 'manual',
    },
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonData +
    closeDelim;

  const uploadUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,modifiedTime,webViewLink';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('توکن اتصال منقضی شده است. لطفاً مجدداً وارد شوید.');
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'خطا در بارگذاری فایل در گوگل درایو.');
  }

  const fileData = await res.json();
  return {
    id: fileData.id,
    name: fileData.name,
    size: fileData.size,
    createdTime: fileData.createdTime,
    modifiedTime: fileData.modifiedTime,
    webViewLink: fileData.webViewLink,
    isAuto,
  };
};

/**
 * List backups from Google Drive folder
 */
export const listDriveBackups = async (
  token: string,
  folderId?: string
): Promise<DriveBackupFile[]> => {
  const targetFolderId = folderId || (await getOrCreateBackupFolder(token));
  const query = encodeURIComponent(
    `'${targetFolderId}' in parents and trashed = false`
  );
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,size,createdTime,modifiedTime,webViewLink,properties)&pageSize=50`;

  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('نشست شما منقضی شده است. لطفاً مجدداً متصل شوید.');
    }
    throw new Error('دریافت لیست فایل‌های پشتیبان از گوگل درایو ناموفق بود.');
  }

  const data = await res.json();
  const files: any[] = data.files || [];

  return files.map(f => ({
    id: f.id,
    name: f.name,
    size: f.size,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    isAuto: f.name?.includes('AutoBackup') || f.properties?.type === 'auto',
  }));
};

/**
 * Download a backup file's raw JSON content
 */
export const downloadBackupFromDrive = async (
  fileId: string,
  token: string
): Promise<string> => {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('نشست منقضی شده است. لطفاً مجدداً وارد شوید.');
    }
    throw new Error('دانلود فایل پشتیبان از درایو با خطا مواجه شد.');
  }

  return await res.text();
};

/**
 * Delete a backup file from Google Drive (MUST be preceded by user confirmation in UI)
 */
export const deleteBackupFromDrive = async (
  fileId: string,
  token: string
): Promise<boolean> => {
  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204 && res.status !== 404) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('نشست منقضی شده است.');
    }
    throw new Error('امکان حذف فایل از گوگل درایو وجود ندارد.');
  }

  return true;
};

/**
 * Prune old auto-backups beyond keepMaxBackups
 */
export const pruneOldAutoBackups = async (
  token: string,
  maxToKeep: number = 15
) => {
  try {
    const list = await listDriveBackups(token);
    const autoBackups = list.filter(f => f.isAuto);
    if (autoBackups.length > maxToKeep) {
      const toDelete = autoBackups.slice(maxToKeep);
      for (const item of toDelete) {
        await deleteBackupFromDrive(item.id, token).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Pruning old auto backups warning:', e);
  }
};
