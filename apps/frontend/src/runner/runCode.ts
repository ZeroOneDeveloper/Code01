import fs from "fs";
import path from "path";
import util from "util";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";

const execAsync = util.promisify(exec);

const TEMP_DIR = path.join(process.cwd(), "submissions");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

export default async function runCTestCases(
  code: string,
  testInputs: string[],
  testOutputs: string[],
  timeLimitMs: number = 20000, // Default to 20 seconds
  memoryLimitMb: number = 128, // Default to 128 MB
): Promise<{
  results: {
    stdout: string;
    stderr: string;
    timeMs: number;
    memoryKb?: number;
    isCorrect: boolean;
    expected: string;
    received: string;
    timeout?: boolean;
    memoryExceeded?: boolean;
  }[];
  is_correct: boolean;
  passed_time_limit: boolean;
  passed_memory_limit: boolean;
  maxTimeMs: number;
  maxMemoryKb?: number;
  compileError?: string;
}> {
  if (timeLimitMs === null) {
    timeLimitMs = 20000; // Default to 20 seconds if not provided
  }
  if (memoryLimitMb === null) {
    memoryLimitMb = 1024; // Default to 128 MB if not provided
  }
  const id = uuidv4();
  const sourcePath = `${TEMP_DIR}/${id}.c`;
  const binaryPath = `${TEMP_DIR}/${id}.out`;

  fs.writeFileSync(sourcePath, code);

  const compileCmd = `docker run --rm -v ${sourcePath}:/app/code.c -v ${TEMP_DIR}:/app gcc-with-time gcc /app/code.c -o /app/${id}.out`;
  try {
    await execAsync(compileCmd);
  } catch (e) {
    fs.unlinkSync(sourcePath);
    const err = e as Error & { stderr?: string };

    return {
      results: [],
      is_correct: false,
      passed_time_limit: false,
      passed_memory_limit: false,
      maxTimeMs: 0,
      compileError: err.stderr || err.message,
    };
  }

  const results = [];

  for (let i = 0; i < testInputs.length; i++) {
    const input = testInputs[i];
    const expected = testOutputs[i].trim();

    const inputCommand = input.trim()
      ? `echo -e "${input.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
      : `cat /dev/null`;

    const memLimit = `${memoryLimitMb}m`;

    const cmd = `
      docker run --rm --network none \
      --memory=${memLimit} \
      -v ${TEMP_DIR}:/app \
      gcc-with-time \
      /bin/bash -c '${inputCommand} | /usr/bin/time -v /app/${id}.out'
    `;

    const start = Date.now();
    let stdout = "",
      stderr = "",
      timeout = false;
    try {
      const result = await execAsync(cmd, { timeout: timeLimitMs });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (e) {
      const eWithDetails = e as Error & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };
      stdout = eWithDetails.stdout || "";
      stderr = eWithDetails.stderr || "";
      if (eWithDetails.killed || eWithDetails.signal === "SIGTERM")
        timeout = true;
    }
    const end = Date.now();

    const timeMs = end - start;

    const memMatch = stderr.match(
      /Maximum resident set size \(kbytes\): (\d+)/,
    );
    const memoryKbUsed = memMatch ? parseInt(memMatch[1], 10) : undefined;
    const memoryExceeded =
      memoryKbUsed !== undefined && memoryKbUsed > memoryLimitMb * 1024;

    const received = stdout.trim();
    const isCorrect = received === expected;

    results.push({
      stdout,
      stderr,
      timeMs,
      memoryKb: memoryKbUsed,
      isCorrect,
      expected,
      received,
      timeout,
      memoryExceeded,
    });
  }

  fs.unlinkSync(sourcePath);
  if (fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);

  const maxTimeMs = Math.max(...results.map((r) => r.timeMs));
  const maxMemoryKb = Math.max(...results.map((r) => r.memoryKb ?? 0));

  const is_correct = results.every((r) => r.isCorrect);
  const passed_time_limit = results.every((r) => r.timeout);
  const passed_memory_limit = results.every(
    (r) => !r.memoryExceeded && r.memoryKb !== undefined,
  );

  return {
    results,
    is_correct,
    passed_time_limit,
    passed_memory_limit,
    maxTimeMs,
    maxMemoryKb,
  };
}
