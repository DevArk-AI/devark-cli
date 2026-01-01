import { spawn, SpawnOptions } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger';

/**
 * Get the upload log file path
 */
export function getUploadLogPath(): string {
  const devarkDir = path.join(os.homedir(), '.devark');
  return path.join(devarkDir, 'upload.log');
}

/**
 * Ensure the .devark directory exists
 */
async function ensureDevArkDir(): Promise<void> {
  const devarkDir = path.join(os.homedir(), '.devark');
  await fs.mkdir(devarkDir, { recursive: true });
}

/**
 * Spawn a detached process that runs in the background
 * Cross-platform support for Windows and Unix systems
 */
export async function spawnDetached(
  command: string,
  args: string[],
  options?: {
    logFile?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<void> {
  await ensureDevArkDir();
  
  const logFile = options?.logFile || getUploadLogPath();
  
  // Write timestamp header
  const timestamp = new Date().toISOString();
  await fs.appendFile(logFile, `\n=== Upload started at ${timestamp} ===\n`);
  
  const spawnOptions: SpawnOptions = {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, ...options?.env, DEVARK_OUTPUT: logFile }
  };
  
  // On Windows, we need to use shell mode for proper detachment
  if (process.platform === 'win32') {
    spawnOptions.shell = true;
    spawnOptions.windowsHide = true;
  }
  
  const child = spawn(command, args, spawnOptions);
  
  // Unref the child process so parent can exit independently
  child.unref();
  
  logger.debug(`Spawned background process with PID: ${child.pid}`);
}

/**
 * Check if a background upload process is already running
 * This prevents duplicate uploads
 */
export async function isUploadRunning(): Promise<boolean> {
  const lockFile = path.join(os.homedir(), '.devark', 'upload.lock');
  
  try {
    const stats = await fs.stat(lockFile);
    const now = Date.now();
    const lockAge = now - stats.mtimeMs;
    
    // If lock is older than 5 minutes, consider it stale
    if (lockAge > 5 * 60 * 1000) {
      await fs.unlink(lockFile).catch(() => {});
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a lock file for upload process
 */
export async function createUploadLock(): Promise<void> {
  await ensureDevArkDir();
  const lockFile = path.join(os.homedir(), '.devark', 'upload.lock');
  await fs.writeFile(lockFile, process.pid.toString());
}

/**
 * Remove the upload lock file
 */
export async function removeUploadLock(): Promise<void> {
  const lockFile = path.join(os.homedir(), '.devark', 'upload.lock');
  await fs.unlink(lockFile).catch(() => {});
}