import { spawn } from "node:child_process";

import * as vscode from "vscode";

import { truncate } from "./utils.js";

export type TerminalOutputHandler = (output: string) => void;

export class TerminalManager {
  private terminal: vscode.Terminal | undefined;

  async run(command: string, cwd: string, timeoutSeconds: number, signal?: AbortSignal, onOutput?: TerminalOutputHandler): Promise<string> {
    const integrated = this.findIntegratedTerminal(cwd);
    if (integrated) return this.runIntegrated(integrated, command, timeoutSeconds, signal, onOutput);
    return this.runChildProcess(command, cwd, timeoutSeconds, signal, onOutput);
  }

  private findIntegratedTerminal(cwd: string): vscode.Terminal | undefined {
    const current = vscode.window.terminals.find((terminal) => terminal.shellIntegration?.cwd?.fsPath === cwd && terminal.exitStatus === undefined);
    if (current) return current;
    if (!this.terminal || this.terminal.exitStatus !== undefined) {
      this.terminal = vscode.window.createTerminal({ name: "Compass Router", cwd });
    }
    return this.terminal.shellIntegration ? this.terminal : undefined;
  }

  private async runIntegrated(terminal: vscode.Terminal, command: string, timeoutSeconds: number, signal?: AbortSignal, onOutput?: TerminalOutputHandler): Promise<string> {
    terminal.show(true);
    const execution = terminal.shellIntegration!.executeCommand(command);
    let output = "";
    let settled = false;
    let endDisposable: vscode.Disposable | undefined;
    const publish = (chunk: string) => {
      output = truncate(`${output}${this.stripAnsi(chunk)}`, 40_000);
      onOutput?.(truncate(`$ ${command}\n${output}`, 12_000));
    };
    const readTask = (async () => {
      try {
        for await (const chunk of execution.read()) publish(chunk);
      } catch {
        // The exit code is the authoritative result when the shell closes the stream.
      }
    })();
    const timeout = Math.max(1, Math.min(timeoutSeconds, 180)) * 1000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutTask = new Promise<never>((_, reject) => { timeoutHandle = setTimeout(() => reject(new Error(`Command timed out after ${Math.round(timeout / 1000)} seconds.`)), timeout); });
    const exitTask = new Promise<number | undefined>((resolve) => {
      endDisposable = vscode.window.onDidEndTerminalShellExecution((event) => {
        if (event.execution === execution) resolve(event.exitCode);
      });
    });
    let abortHandler: (() => void) | undefined;
    const abortTask = new Promise<never>((_, reject) => {
      if (signal?.aborted) {
        terminal.sendText("\u0003", false);
        reject(this.abortError());
        return;
      }
      abortHandler = () => {
        terminal.sendText("\u0003", false);
        reject(this.abortError());
      };
      signal?.addEventListener("abort", abortHandler, { once: true });
    });
    try {
      const exitCode = await Promise.race([exitTask, timeoutTask, abortTask]);
      await readTask;
      settled = true;
      const result = `Exit code: ${exitCode ?? "unknown"}\n${this.stripAnsi(output)}`;
      onOutput?.(truncate(`$ ${command}\n${result}`, 12_000));
      return truncate(result);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
      endDisposable?.dispose();
      if (!settled) terminal.sendText("\u0003", false);
    }
  }

  private runChildProcess(command: string, cwd: string, timeoutSeconds: number, signal?: AbortSignal, onOutput?: TerminalOutputHandler): Promise<string> {
    const timeout = Math.max(1, Math.min(timeoutSeconds, 180)) * 1000;
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (/(_?API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)$/i.test(key)) delete env[key];
      const child = spawn(command, { cwd, shell: true, windowsHide: true, env });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const publish = () => onOutput?.(truncate(`$ ${command}\n${this.stripAnsi(stdout)}${stderr ? `\nSTDERR:\n${this.stripAnsi(stderr)}` : ""}`, 12_000));
      const timer = setTimeout(() => {
        child.kill();
        if (!settled) {
          settled = true;
          reject(new Error(`Command timed out after ${Math.round(timeout / 1000)} seconds.`));
        }
      }, timeout);
      const abort = () => {
        child.kill();
        if (!settled) {
          settled = true;
          reject(this.abortError());
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk: Buffer) => { stdout = truncate(stdout + chunk.toString(), 40_000); publish(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr = truncate(stderr + chunk.toString(), 20_000); publish(); });
      child.on("error", (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (settled) return;
        settled = true;
        const result = truncate(`Exit code: ${code ?? "unknown"}\n${this.stripAnsi(stdout)}${stderr ? `\nSTDERR:\n${this.stripAnsi(stderr)}` : ""}`);
        publish();
        resolve(result);
      });
    });
  }

  private abortError(): Error {
    const error = new Error("Terminal command cancelled.");
    error.name = "AbortError";
    return error;
  }

  private stripAnsi(value: string): string {
    const plain = value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
    return Object.entries(process.env).reduce((result, [key, secret]) => {
      if (!/(_?API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)$/i.test(key) || !secret || secret.length < 8) return result;
      return result.split(secret).join("[REDACTED]");
    }, plain);
  }
}
