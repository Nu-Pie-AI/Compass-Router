import * as vscode from "vscode";

import { randomId } from "./utils.js";

type CheckpointEntry = {
  uri: string;
  backup: string;
  existed: boolean;
};

type CheckpointManifest = {
  id: string;
  label: string;
  createdAt: string;
  entries: CheckpointEntry[];
};

const checkpointStackKey = "compassCode.checkpoints";

export class CheckpointManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async create(label: string, uris: vscode.Uri[]): Promise<string> {
    const id = randomId("checkpoint");
    const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "checkpoints", id);
    await vscode.workspace.fs.createDirectory(directory);
    const entries: CheckpointEntry[] = [];

    for (const [index, uri] of uris.entries()) {
      let existed = true;
      let content = new Uint8Array(0) as Uint8Array<ArrayBuffer>;
      try {
        content = await vscode.workspace.fs.readFile(uri) as Uint8Array<ArrayBuffer>;
      } catch {
        existed = false;
      }
      const backup = vscode.Uri.joinPath(directory, `${index}.bin`);
      await vscode.workspace.fs.writeFile(backup, content);
      entries.push({ uri: uri.toString(), backup: backup.toString(), existed });
    }

    const manifest: CheckpointManifest = { id, label, createdAt: new Date().toISOString(), entries };
      await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(directory, "manifest.json"),
      new TextEncoder().encode(JSON.stringify(manifest, null, 2))
    );
    const stack = this.context.globalState.get<string[]>(checkpointStackKey, []);
    await this.context.globalState.update(checkpointStackKey, [...stack.slice(-29), id]);
    return id;
  }

  async restoreLatest(): Promise<string | null> {
    const stack = this.context.globalState.get<string[]>(checkpointStackKey, []);
    const id = stack.at(-1);
    if (!id) return null;
    const manifestUri = vscode.Uri.joinPath(this.context.globalStorageUri, "checkpoints", id, "manifest.json");
    const manifest = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(manifestUri))) as CheckpointManifest;

    for (const entry of manifest.entries) {
      const uri = vscode.Uri.parse(entry.uri);
      if (entry.existed) {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.parse(entry.backup));
        await vscode.workspace.fs.writeFile(uri, content);
      } else {
        try {
          await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
        } catch {
          // The newly-created file may already have been removed by the user.
        }
      }
    }
    await this.context.globalState.update(checkpointStackKey, stack.slice(0, -1));
    return manifest.label;
  }

  count(): number {
    return this.context.globalState.get<string[]>(checkpointStackKey, []).length;
  }
}
