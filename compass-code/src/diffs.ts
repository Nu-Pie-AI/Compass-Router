import * as vscode from "vscode";

import { randomId } from "./utils.js";

type ReviewEntry = {
  id: string;
  originalUri: vscode.Uri;
  proposedUri: vscode.Uri;
  directoryUri: vscode.Uri;
  title: string;
};

export class DiffReviewManager {
  private readonly entries = new Map<string, ReviewEntry>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async prepare(originalUri: vscode.Uri, proposedContent: string, title: string): Promise<string> {
    const id = randomId("review");
    const directory = vscode.Uri.joinPath(this.context.globalStorageUri, "reviews", id);
    await vscode.workspace.fs.createDirectory(directory);
    const proposedUri = vscode.Uri.joinPath(directory, "proposed.txt");
    await vscode.workspace.fs.writeFile(proposedUri, new TextEncoder().encode(proposedContent));
    this.entries.set(id, { id, originalUri, proposedUri, directoryUri: directory, title });
    await this.open(id);
    return id;
  }

  async open(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("This change review is no longer available.");
    await vscode.commands.executeCommand("vscode.diff", entry.originalUri, entry.proposedUri, entry.title);
  }

  async discard(id: string | undefined): Promise<void> {
    if (!id) return;
    const entry = this.entries.get(id);
    this.entries.delete(id);
    if (!entry) return;
    try {
      await vscode.workspace.fs.delete(entry.directoryUri, { recursive: true, useTrash: false });
    } catch {
      // Review cleanup must not hide the result of the approved or rejected action.
    }
  }
}
