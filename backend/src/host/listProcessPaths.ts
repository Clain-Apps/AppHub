import { execFile } from "node:child_process";
import { readdir, readFile, readlink } from "node:fs/promises";
import { platform } from "node:os";
import { promisify } from "node:util";

const runExecutable = promisify(execFile);

/**
 * Working directories and command lines of processes on this host.
 * Linux uses `/proc`. Windows uses process command lines from PowerShell.
 */
export async function listProcessPaths(): Promise<string[]> {
  if (platform() === "win32") return listWindowsProcessPaths();
  return listLinuxProcessPaths();
}

async function listLinuxProcessPaths(): Promise<string[]> {
  const paths: string[] = [];
  const entries = await readdir("/proc", { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!/^\d+$/.test(entry.name)) continue;
    const processIdentifier = entry.name;
    try {
      paths.push(await readlink(`/proc/${processIdentifier}/cwd`));
    } catch {
      // The process exited, or this user cannot read its working directory.
    }
    try {
      const commandLine = await readFile(`/proc/${processIdentifier}/cmdline`, "utf8");
      const joinedCommandLine = commandLine.replaceAll("\0", " ").trim();
      if (joinedCommandLine) paths.push(joinedCommandLine);
    } catch {
      // The process exited, or this user cannot read its command line.
    }
  }

  return paths;
}

async function listWindowsProcessPaths(): Promise<string[]> {
  try {
    const { stdout } = await runExecutable(
      "powershell.exe",
      ["-NoProfile", "-Command", "Get-CimInstance Win32_Process | ForEach-Object { if ($_.CommandLine) { $_.CommandLine } }"],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
