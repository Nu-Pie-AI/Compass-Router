"use client";

import {
  Copy,
  KeyRound,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiFetch, formatPaise } from "../lib/api";

type Key = {
  id: string;
  name: string;
  key: string;
  status: string;
  team_id?: string | null;
  allowed_models?: string[];
  models_restricted?: boolean;
  last_used_at?: string | null;
  expires_at?: string | null;
  rate_limit?: number;
  daily_limit_paise?: number;
  monthly_limit_paise?: number;
  usage?: { requests: number; tokens: number; spend_paise: number };
};

type ModelOption = {
  id: string;
  status: string;
  provider?: string;
  display_name?: string;
  provider_model_id?: string;
  compass_model_id?: string | null;
  credential_available?: boolean;
  selectable?: boolean;
};
type Dashboard = {
  teams: { id: string; name: string; is_active: boolean }[];
  api_keys: Key[];
  models: ModelOption[];
};

export type KeyManagerProps = {
  dashboard: Dashboard | null;
  token: string;
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  keyName: string;
  setKeyName: (name: string) => void;
  oneTimeKey: string;
  dismissKey: () => void;
  createKey: () => Promise<boolean>;
  updateKeyModels: (id: string, models: string[]) => Promise<boolean>;
  revokeKeys: (ids: string[]) => Promise<boolean>;
  busy: boolean;
};

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(
        new Date(
          value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)
            ? value
            : `${value}Z`,
        ),
      )
    : "Never";
}

export function ApiKeyManager(props: KeyManagerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const revokeDialog = useRef<HTMLDialogElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [revokeIds, setRevokeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [editKey, setEditKey] = useState<Key | null>(null);
  const [editModels, setEditModels] = useState<string[]>([]);
  const [editError, setEditError] = useState("");
  const [modelProvider, setModelProvider] = useState("all");
  const [modelSearch, setModelSearch] = useState("");
  const [catalogModels, setCatalogModels] = useState<ModelOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const keys = (props.dashboard?.api_keys ?? []).filter(
    (key) =>
      (!props.selectedTeamId || key.team_id === props.selectedTeamId) &&
      `${key.name} ${key.key}`.toLowerCase().includes(search.toLowerCase()),
  );
  const active = keys.filter((key) => key.status === "active");
  const selectedVisible = selected.filter((id) =>
    active.some((key) => key.id === id),
  );
  useEffect(() => {
    if (!editKey || !props.token) return;
    let active = true;
    const teamQuery = props.selectedTeamId
      ? `?team_id=${encodeURIComponent(props.selectedTeamId)}`
      : "";
    void Promise.resolve().then(() => {
      if (!active) return;
      setCatalogLoading(true);
      setCatalogError("");
      return apiFetch<{ models?: ModelOption[] }>(
        `/catalog/models${teamQuery}`,
        {},
        props.token,
      )
        .then((result) => {
          if (!active) return;
          const models = (result.models ?? []).map((model) => ({
            ...model,
            id: model.compass_model_id ?? model.provider_model_id ?? model.id,
            selectable: Boolean(model.compass_model_id),
          }));
          setCatalogModels(models);
        })
        .catch(() => {
          if (!active) return;
          setCatalogModels([]);
          setCatalogError(
            "The full catalog is unavailable. Showing configured models.",
          );
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [editKey, props.selectedTeamId, props.token]);

  const availableModels = catalogModels.length
    ? catalogModels
    : (props.dashboard?.models ?? []).map((model) => ({
        ...model,
        selectable: true,
      }));
  const providers = Array.from(
    new Set(
      availableModels.map(
        (model) => model.provider ?? model.id.split("/", 1)[0],
      ),
    ),
  ).sort();
  const visibleModels = availableModels.filter((model) => {
    const provider = model.provider ?? model.id.split("/", 1)[0];
    const query = modelSearch.trim().toLowerCase();
    return (
      (modelProvider === "all" || provider === modelProvider) &&
      (!query ||
        `${provider} ${model.display_name ?? ""} ${model.id}`
          .toLowerCase()
          .includes(query))
    );
  });

  useEffect(() => {
    if (revokeIds.length) revokeDialog.current?.showModal();
  }, [revokeIds]);

  useEffect(() => {
    if (editKey) editDialog.current?.showModal();
  }, [editKey]);

  function toggle(id: string) {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id],
    );
  }

  function openEditModels(key: Key) {
    setEditKey(key);
    setEditModels(key.models_restricted ? (key.allowed_models ?? []) : []);
    setModelProvider("all");
    setModelSearch("");
    setEditError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!props.keyName.trim()) {
      setFormError("Enter a key name.");
      return;
    }
    setFormError("");
    if (await props.createKey()) dialog.current?.close();
    else
      setFormError("Key creation failed. See the status message on this page.");
  }

  async function revoke() {
    if (await props.revokeKeys(revokeIds)) {
      setSelected([]);
      setRevokeIds([]);
      revokeDialog.current?.close();
    }
  }

  function toggleModel(modelId: string) {
    setEditModels((models) =>
      models.includes(modelId)
        ? models.filter((id) => id !== modelId)
        : [...models, modelId],
    );
  }

  function selectVisibleModels() {
    setEditModels((current) =>
      Array.from(
        new Set([
          ...current,
          ...visibleModels
            .filter((model) => model.selectable !== false)
            .map((model) => model.id),
        ]),
      ),
    );
  }

  function clearVisibleModels() {
    setEditModels((current) =>
      current.filter((id) => !visibleModels.some((model) => model.id === id)),
    );
  }

  return (
    <>
      <div className="key-actions">
        <span className="key-scope">
          <ShieldCheck size={16} />
          Team-scoped credentials
        </span>
        <button
          className="console-primary"
          disabled={
            !props.dashboard?.teams.some((team) => team.is_active) || props.busy
          }
          onClick={() => {
            setFormError("");
            dialog.current?.showModal();
          }}
        >
          <Plus size={18} />
          New Key
        </button>
      </div>

      {props.oneTimeKey ? (
        <section className="key-reveal" aria-label="New API key">
          <div className="flex items-center justify-between">
            <strong>Save your API key. It is only shown once.</strong>
            <button
              className="console-icon"
              aria-label="Dismiss full API key"
              title="Dismiss full API key"
              onClick={props.dismissKey}
            >
              <X size={18} />
            </button>
          </div>
          <code>{props.oneTimeKey}</code>
          <button
            className="console-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(props.oneTimeKey);
                setCopied(true);
                setCopyError("");
              } catch {
                setCopyError(
                  "Clipboard unavailable. Select and copy the key above.",
                );
              }
            }}
          >
            <Copy size={16} />
            {copied ? "Copied" : "Copy key"}
          </button>
          {copyError ? <p role="alert">{copyError}</p> : null}
        </section>
      ) : null}

      <section className="keys-surface" aria-label="API keys">
        <div className="keys-toolbar">
          <label className="key-search">
            <Search size={18} />
            <input
              aria-label="Search keys by name or masked prefix"
              placeholder="Search by name or masked key..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {selectedVisible.length ? (
            <button
              className="console-secondary danger"
              disabled={props.busy}
              onClick={() => setRevokeIds(selectedVisible)}
            >
              <Trash2 size={16} />
              Revoke {selectedVisible.length}
            </button>
          ) : null}
        </div>
        <div className="keys-scroll">
          <table className="keys-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    aria-label="Select all visible active keys"
                    checked={
                      active.length > 0 &&
                      active.every((key) => selected.includes(key.id))
                    }
                    disabled={!active.length}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? active.map((key) => key.id) : [],
                      )
                    }
                  />
                </th>
                <th>Key</th>
                <th>Allowed models</th>
                <th>Expires</th>
                <th>Last used</th>
                <th>Status</th>
                <th>Key usage / limit</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!props.dashboard ? (
                <tr>
                  <td colSpan={8} className="key-empty">
                    Loading keys...
                  </td>
                </tr>
              ) : keys.length ? (
                keys.map((key) => (
                  <tr key={key.id}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${key.name}`}
                        checked={selected.includes(key.id)}
                        disabled={key.status !== "active"}
                        onChange={() => toggle(key.id)}
                      />
                    </td>
                    <td>
                      <strong>{key.name}</strong>
                      <code>{key.key}</code>
                      <small>
                        {props.dashboard?.teams.find(
                          (team) => team.id === key.team_id,
                        )?.name ?? "Unassigned"}
                      </small>
                    </td>
                    <td>
                      <div className="key-models">
                        {key.models_restricted ? (
                          key.allowed_models?.map((model) => (
                            <span key={model}>{model}</span>
                          ))
                        ) : (
                          <span>All available models</span>
                        )}
                      </div>
                    </td>
                    <td>{date(key.expires_at)}</td>
                    <td>{date(key.last_used_at)}</td>
                    <td>
                      <span
                        className={`key-status ${key.status === "active" ? "active" : "revoked"}`}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td>
                      <div className="key-usage">
                        <strong>
                          {key.usage?.requests ?? 0} requests -{" "}
                          {formatPaise(key.usage?.spend_paise)}
                        </strong>
                        <small>
                          {formatPaise(key.daily_limit_paise)} daily /{" "}
                          {formatPaise(key.monthly_limit_paise)} monthly
                        </small>
                      </div>
                    </td>
                    <td>
                      <details className="key-menu">
                        <summary
                          aria-label={`Actions for ${key.name}`}
                          title="Key actions"
                        >
                          <MoreVertical size={18} />
                        </summary>
                        <div>
                          <button
                            disabled={key.status !== "active" || props.busy}
                            onClick={() => openEditModels(key)}
                          >
                            <ShieldCheck size={16} />
                            Edit models
                          </button>
                          <button
                            disabled={key.status !== "active" || props.busy}
                            onClick={() => setRevokeIds([key.id])}
                          >
                            <Trash2 size={16} />
                            Revoke key
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="key-empty">
                    <KeyRound size={24} />
                    <strong>
                      {search
                        ? "No matching keys"
                        : "No keys in this workspace"}
                    </strong>
                    <span>
                      {search
                        ? "Try a different name or masked prefix."
                        : "Create a key for this team to get started."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="keys-footer">
          <span>
            {keys.length} {keys.length === 1 ? "key" : "keys"}
          </span>
          <span>Only masked keys are stored in this list.</span>
        </footer>
      </section>

      <dialog
        ref={dialog}
        className="console-dialog"
        aria-labelledby="create-key-title"
      >
        <form onSubmit={(event) => void submit(event)}>
          <div className="dialog-heading">
            <h2 id="create-key-title">Create API key</h2>
            <button
              className="console-icon"
              type="button"
              aria-label="Close new key dialog"
              disabled={props.busy}
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <label>
            Key name
            <input
              autoFocus
              required
              maxLength={80}
              value={props.keyName}
              onChange={(event) => props.setKeyName(event.target.value)}
            />
          </label>
          <label>
            Attach to team
            <select
              required
              value={props.selectedTeamId}
              onChange={(event) => props.setSelectedTeamId(event.target.value)}
            >
              {(props.dashboard?.teams ?? [])
                .filter((team) => team.is_active)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="field-help">
            This key starts with access to all available models. You can
            restrict it later from the key actions menu.
          </p>
          {formError ? (
            <p className="dialog-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="dialog-footer">
            <button
              className="console-secondary"
              disabled={props.busy}
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              className="console-primary"
              disabled={props.busy}
              type="submit"
            >
              <Plus size={17} />
              {props.busy ? "Creating..." : "Create key"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={editDialog}
        className="console-dialog model-access-dialog"
        aria-labelledby="edit-key-title"
        onClose={() => {
          setEditKey(null);
          setModelProvider("all");
          setModelSearch("");
          setCatalogModels([]);
        }}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!editKey) return;
            setEditError("");
            if (await props.updateKeyModels(editKey.id, editModels))
              editDialog.current?.close();
            else
              setEditError(
                "Could not update model access. See the status message on this page.",
              );
          }}
        >
          <div className="dialog-heading">
            <h2 id="edit-key-title">Edit model access</h2>
            <button
              className="console-icon"
              type="button"
              aria-label="Close model access dialog"
              disabled={props.busy}
              onClick={() => editDialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <p className="field-help">
            Leave all models unchecked for unrestricted access. Selecting models
            restricts this key to those models.
          </p>
          <fieldset>
            <legend>Allowed models</legend>
            <div className="model-access-filter-grid">
              <label className="model-access-provider-select">
                <span>Provider</span>
                <select
                  aria-label="Filter models by provider"
                  value={modelProvider}
                  onChange={(event) => setModelProvider(event.target.value)}
                >
                  <option value="all">All providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>
              <label className="model-access-search">
                <span>Search</span>
                <div className="model-access-search-input">
                  <Search size={16} />
                  <input
                    aria-label="Search models"
                    placeholder="Search models or providers..."
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                  />
                </div>
              </label>
            </div>
            <div className="model-selection-toolbar">
              <span>
                {catalogLoading
                  ? "Loading full catalog..."
                  : `${visibleModels.length} model${visibleModels.length === 1 ? "" : "s"} shown - ${editModels.length} selected`}
              </span>
              <div>
                <button
                  type="button"
                  className="console-link"
                  disabled={
                    !visibleModels.some((model) => model.selectable !== false)
                  }
                  onClick={selectVisibleModels}
                >
                  Select shown
                </button>
                <button
                  type="button"
                  className="console-link"
                  disabled={
                    !visibleModels.some((model) =>
                      editModels.includes(model.id),
                    )
                  }
                  onClick={clearVisibleModels}
                >
                  Clear shown
                </button>
              </div>
            </div>
            {catalogError ? <p className="field-help">{catalogError}</p> : null}
            <div className="model-options">
              {visibleModels.map((model) => {
                const provider = model.provider ?? model.id.split("/", 1)[0];
                const selectable = model.selectable !== false;
                return (
                  <label
                    key={model.id}
                    className={!selectable ? "model-catalog-only" : undefined}
                  >
                    <input
                      type="checkbox"
                      disabled={!selectable}
                      checked={editModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                    />
                    <span>
                      <strong>{model.display_name ?? model.id}</strong>
                      <code>{model.id}</code>
                      <small>
                        {provider} -{" "}
                        {selectable
                          ? "available"
                          : "catalog only; activate it in Models first"}
                      </small>
                    </span>
                  </label>
                );
              })}
              {!visibleModels.length ? (
                <p className="field-help">
                  No models match this provider and search.
                </p>
              ) : null}
            </div>
          </fieldset>
          {editError ? (
            <p className="dialog-error" role="alert">
              {editError}
            </p>
          ) : null}
          <div className="dialog-footer">
            <button
              className="console-secondary"
              disabled={props.busy}
              type="button"
              onClick={() => editDialog.current?.close()}
            >
              Cancel
            </button>
            <button
              className="console-primary"
              disabled={props.busy}
              type="submit"
            >
              <ShieldCheck size={17} />
              {props.busy ? "Saving..." : "Save access"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={revokeDialog}
        className="console-dialog"
        aria-labelledby="revoke-key-title"
        onClose={() => setRevokeIds([])}
      >
        <h2 id="revoke-key-title">
          Revoke{" "}
          {revokeIds.length === 1 ? "API key" : `${revokeIds.length} API keys`}?
        </h2>
        <p>
          Applications using these keys will lose access immediately. This
          cannot be undone.
        </p>
        <div className="dialog-footer">
          <button
            className="console-secondary"
            disabled={props.busy}
            onClick={() => revokeDialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="console-primary danger-button"
            disabled={props.busy}
            onClick={() => void revoke()}
          >
            <Trash2 size={17} />
            {props.busy ? "Revoking..." : "Revoke"}
          </button>
        </div>
      </dialog>
    </>
  );
}
