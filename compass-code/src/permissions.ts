import * as vscode from "vscode";

import type { PermissionDecision, ToolKind } from "./types.js";

export class PermissionManager {
  private readonly sessionKinds = new Set<ToolKind>();
  private readonly sessionDeniedKinds = new Set<ToolKind>();

  isAllowed(kind: ToolKind): boolean {
    if (this.sessionDeniedKinds.has(kind)) return false;
    if (kind === "read" || this.sessionKinds.has(kind)) return true;
    const config = vscode.workspace.getConfiguration("compassCode");
    if (kind === "write") return config.get<boolean>("autoApproveWrites", false);
    if (kind === "execute") return config.get<boolean>("autoApproveTerminal", false);
    return config.get<boolean>("autoApproveNetwork", false);
  }

  isDenied(kind: ToolKind): boolean {
    return this.sessionDeniedKinds.has(kind);
  }

  async remember(kind: ToolKind, decision: PermissionDecision): Promise<void> {
    if (decision === "session") {
      this.sessionKinds.add(kind);
      this.sessionDeniedKinds.delete(kind);
      return;
    }
    if (decision === "session-deny") {
      this.sessionDeniedKinds.add(kind);
      this.sessionKinds.delete(kind);
      return;
    }
    if (decision !== "always") return;
    const config = vscode.workspace.getConfiguration("compassCode");
    if (kind === "write") await config.update("autoApproveWrites", true, vscode.ConfigurationTarget.Global);
    if (kind === "execute") await config.update("autoApproveTerminal", true, vscode.ConfigurationTarget.Global);
    if (kind === "network") await config.update("autoApproveNetwork", true, vscode.ConfigurationTarget.Global);
  }

  clearSession(): void {
    this.sessionKinds.clear();
    this.sessionDeniedKinds.clear();
  }
}
