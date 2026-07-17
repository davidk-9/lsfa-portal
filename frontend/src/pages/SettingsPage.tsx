import { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { settingsApi } from '../api';
import './SettingsPage.css';

type TabId = 'api' | 'course-codes' | 'trainer-portal' | 'azure-storage' | 'checklists' | 'practical-tasks' | 'success-comments' | 'ai' | 'bulk-scheduler' | 'wp-sync';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'api', label: 'API Credentials' },
  { id: 'course-codes', label: 'Course Codes' },
  { id: 'trainer-portal', label: 'Trainer Portal' },
  { id: 'azure-storage', label: 'Azure Storage' },
  { id: 'checklists', label: 'Course Checklists' },
  { id: 'practical-tasks', label: 'Practical Tasks' },
  { id: 'success-comments', label: 'Success Comments' },
  { id: 'ai', label: 'AI Evidence' },
  { id: 'bulk-scheduler', label: 'Bulk Scheduler' },
  { id: 'wp-sync', label: 'WordPress Sync' },
];

// Setting keys
const KEYS = {
  WS_TOKEN: 'axcelerate_ws_token',
  API_TOKEN: 'axcelerate_api_token',
  WORKSHOP_URL: 'axcelerate_workshop_url',
  DEFAULT_CONTACT_ID: 'axcelerate_default_contact_id',
  COURSE_CODES: 'course_code_lookup',
  STEP1: 'trainer_step1_instruction',
  STEP2: 'trainer_step2_instruction',
  STEP3_ENABLED: 'trainer_step3_instruction_enabled',
  STEP3_DISABLED: 'trainer_step3_instruction_disabled',
  IF_CODES: 'trainer_if_course_codes',
  EVIDENCE_BTN: 'trainer_enable_evidence_button',
  CHECKLISTS: 'observation_checklists',
  AZURE_MODE: 'azure_storage_mode',
  AZURE_ACCOUNT: 'azure_storage_account',
  AZURE_CONTAINER: 'azure_storage_container',
  AZURE_TENANT_ID: 'azure_tenant_id',
  AZURE_CLIENT_ID: 'azure_client_id',
  AZURE_CLIENT_SECRET: 'azure_client_secret',
  AZURE_LINK_MODE: 'azure_link_mode',
  AZURE_SAS_TOKEN: 'azure_sas_token',
  AZURE_PATH_PREFIX: 'azure_path_prefix',
  PUBLIC_BASE_URL: 'public_base_url',
  OPENAI_API_KEY: 'openai_api_key',
  AI_MODEL_PRIMARY: 'ai_model_primary',
  AI_MODEL_FALLBACK: 'ai_model_fallback',
  WP_SYNC_URL: 'wp_sync_url',
  WP_SYNC_TOKEN: 'wp_sync_token',
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('api');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.getAll()
      .then((res) => setSettings(res.data))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await settingsApi.saveAll(payload);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const val = (key: string) => settings[key] ?? '';

  if (loading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <div className="settings-save-bar">
          {saved && <span className="settings-saved-msg">✓ Settings saved</span>}
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'api' && (
            <ApiCredentialsTab val={val} set={set} />
          )}
          {activeTab === 'course-codes' && (
            <CourseCodesTab val={val} set={set} />
          )}
          {activeTab === 'trainer-portal' && (
            <TrainerPortalTab val={val} set={set} />
          )}
          {activeTab === 'azure-storage' && (
            <AzureStorageTab val={val} set={set} />
          )}
          {activeTab === 'checklists' && (
            <ChecklistJsonTab val={val} set={set} />
          )}
          {activeTab === 'practical-tasks' && (
            <PracticalTasksTab val={val} set={set} />
          )}
          {activeTab === 'success-comments' && (
            <SuccessCommentsTab val={val} set={set} />
          )}
          {activeTab === 'ai' && (
            <AiSettingsTab val={val} set={set} />
          )}
          {activeTab === 'bulk-scheduler' && (
            <PlaceholderTab label={TABS.find(t => t.id === activeTab)!.label} />
          )}
          {activeTab === 'wp-sync' && (
            <WpSyncTab val={val} set={set} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: API Credentials ────────────────────────────────────────────────────

function ApiCredentialsTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [showWs, setShowWs] = useState(false);
  const [showApi, setShowApi] = useState(false);

  return (
    <div className="tab-panel">
      <h2>API Credentials</h2>
      <p className="tab-description">
        Axcelerate API credentials and configuration. These are used to fetch workshops, trainers, and other data from Axcelerate.
      </p>

      <SettingSection title="Axcelerate Authentication">
        <SettingField
          label="WS Token"
          hint="The wstoken header value for Axcelerate API requests."
        >
          <div className="input-with-toggle">
            <input
              type={showWs ? 'text' : 'password'}
              value={val(KEYS.WS_TOKEN)}
              onChange={(e) => set(KEYS.WS_TOKEN, e.target.value)}
              placeholder="Enter WS Token"
              className="setting-input"
            />
            <button type="button" className="toggle-visibility" onClick={() => setShowWs(v => !v)}>
              {showWs ? 'Hide' : 'Show'}
            </button>
          </div>
        </SettingField>

        <SettingField
          label="API Token"
          hint="The apitoken header value for Axcelerate API requests."
        >
          <div className="input-with-toggle">
            <input
              type={showApi ? 'text' : 'password'}
              value={val(KEYS.API_TOKEN)}
              onChange={(e) => set(KEYS.API_TOKEN, e.target.value)}
              placeholder="Enter API Token"
              className="setting-input"
            />
            <button type="button" className="toggle-visibility" onClick={() => setShowApi(v => !v)}>
              {showApi ? 'Hide' : 'Show'}
            </button>
          </div>
        </SettingField>
      </SettingSection>

      <SettingSection title="Workshop Links">
        <SettingField
          label="Axcelerate Workshop URL Base"
          hint="The base URL used to open a workshop in Axcelerate. The instance ID will be appended. e.g. https://lifesavingfirstaid.app.axcelerate.com/..."
        >
          <input
            type="url"
            value={val(KEYS.WORKSHOP_URL)}
            onChange={(e) => set(KEYS.WORKSHOP_URL, e.target.value)}
            placeholder="https://lifesavingfirstaid.app.axcelerate.com/..."
            className="setting-input setting-input-wide"
          />
        </SettingField>
      </SettingSection>

      <SettingSection title="Bulk Scheduler">
        <SettingField
          label="Default Contact ID"
          hint="The Axcelerate contact ID used as the default trainer when bulk-generating workshops."
        >
          <input
            type="text"
            value={val(KEYS.DEFAULT_CONTACT_ID)}
            onChange={(e) => set(KEYS.DEFAULT_CONTACT_ID, e.target.value)}
            placeholder="e.g. 12345"
            className="setting-input setting-input-short"
          />
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: Course Codes ───────────────────────────────────────────────────────

function CourseCodesTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  return (
    <div className="tab-panel">
      <h2>Course Code Lookup</h2>
      <p className="tab-description">
        Maps Axcelerate course codes to short display names used in the calendar. One entry per line in the format <code>CODE - Short Name</code>.
      </p>

      <SettingSection title="Course Codes">
        <SettingField
          label="Code Mappings"
          hint='One mapping per line. Format: CODE - Short Name. Example: HLTAID011 - Provide First Aid'
        >
          <textarea
            value={val(KEYS.COURSE_CODES)}
            onChange={(e) => set(KEYS.COURSE_CODES, e.target.value)}
            placeholder={'HLTAID011 - Provide First Aid\nHLTAID009 - Provide CPR'}
            className="setting-textarea"
            rows={16}
            spellCheck={false}
          />
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: AI Evidence ─────────────────────────────────────────────────────────

function AiSettingsTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="tab-panel">
      <h2>AI Evidence</h2>
      <p className="tab-description">
        Configuration for the AI-assisted bulk evidence uploader. Trainers scan a stack of paperwork as a
        single PDF, and the AI identifies the student and paperwork type for each page before upload.
      </p>

      <SettingSection title="OpenAI">
        <SettingField label="OpenAI API Key" hint="Your OpenAI API key. Stored here in Settings — never hard-coded.">
          <div className="input-with-toggle">
            <input
              type={showKey ? 'text' : 'password'}
              value={val(KEYS.OPENAI_API_KEY)}
              onChange={(e) => set(KEYS.OPENAI_API_KEY, e.target.value)}
              placeholder="sk-..."
              className="setting-input"
            />
            <button type="button" className="toggle-visibility" onClick={() => setShowKey(v => !v)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </SettingField>
      </SettingSection>

      <SettingSection title="Models">
        <SettingField label="Primary Model" hint='Model used first for page classification. Default: "gpt-5.4-nano".'>
          <input
            type="text"
            value={val(KEYS.AI_MODEL_PRIMARY) || 'gpt-5.4-nano'}
            onChange={(e) => set(KEYS.AI_MODEL_PRIMARY, e.target.value)}
            className="setting-input"
            placeholder="gpt-5.4-nano"
          />
        </SettingField>
        <SettingField label="Fallback Model" hint='Re-checks low-confidence pages. Default: "gpt-5.4-mini". Set equal to the primary model to disable fallback.'>
          <input
            type="text"
            value={val(KEYS.AI_MODEL_FALLBACK) || 'gpt-5.4-mini'}
            onChange={(e) => set(KEYS.AI_MODEL_FALLBACK, e.target.value)}
            className="setting-input"
            placeholder="gpt-5.4-mini"
          />
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: Azure Storage ───────────────────────────────────────────────────────

function AzureStorageTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {  const [showSecret, setShowSecret] = useState(false);
  const [showSas, setShowSas] = useState(false);
  const isEnabled = val(KEYS.AZURE_MODE) === 'azure';

  return (
    <div className="tab-panel">
      <h2>Azure Storage</h2>
      <p className="tab-description">
        Configure Azure Blob Storage for file uploads (student images, checklists, evidence files).
        When disabled, file uploads will not be available.
      </p>

      <SettingSection title="Storage Mode">
        <SettingField label="Enable Azure Storage" hint="When enabled, all file uploads are stored in Azure Blob Storage.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => set(KEYS.AZURE_MODE, e.target.checked ? 'azure' : '')}
            />
            Enabled
          </label>
        </SettingField>
      </SettingSection>

      <SettingSection title="Storage Account">
        <SettingField label="Storage Account Name" hint="e.g. mycompanystorage">
          <input type="text" value={val(KEYS.AZURE_ACCOUNT)} onChange={(e) => set(KEYS.AZURE_ACCOUNT, e.target.value)} className="setting-input" placeholder="storageaccountname" />
        </SettingField>
        <SettingField label="Container Name" hint="The blob container where files will be stored.">
          <input type="text" value={val(KEYS.AZURE_CONTAINER)} onChange={(e) => set(KEYS.AZURE_CONTAINER, e.target.value)} className="setting-input" placeholder="container-name" />
        </SettingField>
        <SettingField label="Path Prefix" hint='Prefix for all blob paths. Default: "lsfa"'>
          <input type="text" value={val(KEYS.AZURE_PATH_PREFIX) || 'lsfa'} onChange={(e) => set(KEYS.AZURE_PATH_PREFIX, e.target.value)} className="setting-input setting-input-short" placeholder="lsfa" />
        </SettingField>
      </SettingSection>

      <SettingSection title="AAD Authentication">
        <SettingField label="Tenant ID" hint="Azure Active Directory tenant ID.">
          <input type="text" value={val(KEYS.AZURE_TENANT_ID)} onChange={(e) => set(KEYS.AZURE_TENANT_ID, e.target.value)} className="setting-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </SettingField>
        <SettingField label="Client ID" hint="AAD application (client) ID.">
          <input type="text" value={val(KEYS.AZURE_CLIENT_ID)} onChange={(e) => set(KEYS.AZURE_CLIENT_ID, e.target.value)} className="setting-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </SettingField>
        <SettingField label="Client Secret" hint="AAD application client secret.">
          <div className="input-with-toggle">
            <input type={showSecret ? 'text' : 'password'} value={val(KEYS.AZURE_CLIENT_SECRET)} onChange={(e) => set(KEYS.AZURE_CLIENT_SECRET, e.target.value)} className="setting-input" placeholder="Client secret value" />
            <button type="button" className="toggle-visibility" onClick={() => setShowSecret(v => !v)}>{showSecret ? 'Hide' : 'Show'}</button>
          </div>
        </SettingField>
      </SettingSection>

      <SettingSection title="File URL Mode">
        <SettingField label="Link Mode" hint='"sas" generates time-limited secure URLs. "public" serves files directly (container must be public).'>
          <select value={val(KEYS.AZURE_LINK_MODE) || 'sas'} onChange={(e) => set(KEYS.AZURE_LINK_MODE, e.target.value)} className="setting-input setting-input-short" style={{ fontFamily: 'inherit' }}>
            <option value="sas">SAS (recommended)</option>
            <option value="public">Public</option>
          </select>
        </SettingField>
        {(val(KEYS.AZURE_LINK_MODE) || 'sas') === 'sas' && (
          <SettingField label="SAS Token" hint="Shared Access Signature token. Include the leading ?. Required when link mode is SAS.">
            <div className="input-with-toggle">
              <input type={showSas ? 'text' : 'password'} value={val(KEYS.AZURE_SAS_TOKEN)} onChange={(e) => set(KEYS.AZURE_SAS_TOKEN, e.target.value)} className="setting-input setting-input-wide" placeholder="?sv=...&sig=..." />
              <button type="button" className="toggle-visibility" onClick={() => setShowSas(v => !v)}>{showSas ? 'Hide' : 'Show'}</button>
            </div>
          </SettingField>
        )}
      </SettingSection>

      <SettingSection title="Durable File Proxy">
        <SettingField label="Public Base URL" hint='Base URL for stable file links stored in Axcelerate, e.g. "https://app.lifesavingfirstaid.com.au". Files are served via {base}/proxy/{key}, which redirects to a freshly minted SAS link. Defaults to http://localhost:3000 for local testing.'>
          <input type="text" value={val(KEYS.PUBLIC_BASE_URL)} onChange={(e) => set(KEYS.PUBLIC_BASE_URL, e.target.value)} className="setting-input setting-input-wide" placeholder="https://app.lifesavingfirstaid.com.au" />
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: Trainer Portal ─────────────────────────────────────────────────────

const DEFAULT_STEP1 = 'Check each student has completed (C) their online knowledge assessment OLKA, then mark attendance.';
const DEFAULT_STEP2 = 'Mark all tasks satisfactory, then manually mark students who got something wrong using the wizard. Once all checklists are complete, upload all checklists. If you make a mistake you can reset all checklists, but reset will not reset already uploaded checklists.';
const DEFAULT_STEP3_ENABLED = 'You can either upload 1 combined scanner file for all student declarations and incident report forms using the Upload Workshop Evidence File button, OR you can upload SD and IF files individually for each student.';
const DEFAULT_STEP3_DISABLED = 'Workshop evidence upload is currently disabled. You can still upload SD and IF files individually for each attended student.';

function TrainerPortalTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  return (
    <div className="tab-panel">
      <h2>Trainer Portal</h2>
      <p className="tab-description">
        Configure the trainer portal workflow instructions and evidence upload settings.
      </p>

      <SettingSection title="Workflow Step Instructions">
        <SettingField label="Step 1 — Mark Attendance" hint="Shown on the Step 1 tab in the workshop detail view.">
          <textarea
            value={val(KEYS.STEP1) || DEFAULT_STEP1}
            onChange={(e) => set(KEYS.STEP1, e.target.value)}
            className="setting-textarea" rows={3}
          />
        </SettingField>
        <SettingField label="Step 2 — Mark Checklists" hint="Shown on the Step 2 tab in the workshop detail view.">
          <textarea
            value={val(KEYS.STEP2) || DEFAULT_STEP2}
            onChange={(e) => set(KEYS.STEP2, e.target.value)}
            className="setting-textarea" rows={4}
          />
        </SettingField>
        <SettingField label="Step 3 — Upload Evidence (enabled)" hint="Shown on Step 3 when the evidence upload button is enabled.">
          <textarea
            value={val(KEYS.STEP3_ENABLED) || DEFAULT_STEP3_ENABLED}
            onChange={(e) => set(KEYS.STEP3_ENABLED, e.target.value)}
            className="setting-textarea" rows={3}
          />
        </SettingField>
        <SettingField label="Step 3 — Upload Evidence (disabled)" hint="Shown on Step 3 when the evidence upload button is disabled.">
          <textarea
            value={val(KEYS.STEP3_DISABLED) || DEFAULT_STEP3_DISABLED}
            onChange={(e) => set(KEYS.STEP3_DISABLED, e.target.value)}
            className="setting-textarea" rows={3}
          />
        </SettingField>
      </SettingSection>

      <SettingSection title="Evidence Upload">
        <SettingField label="Enable Workshop Evidence Button" hint="When enabled, trainers can upload a single workshop-level evidence file on Step 3.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={(val(KEYS.EVIDENCE_BTN) ?? '1') !== '0'}
              onChange={(e) => set(KEYS.EVIDENCE_BTN, e.target.checked ? '1' : '0')}
            />
            Enabled
          </label>
        </SettingField>
        <SettingField
          label="Incident Form (IF) Course Codes"
          hint="Comma-separated course codes that require an Incident Form upload. Leave blank to show IF button for all courses."
        >
          <input
            type="text"
            value={val(KEYS.IF_CODES)}
            onChange={(e) => set(KEYS.IF_CODES, e.target.value)}
            placeholder="e.g. HLTAID014, HLTAID015"
            className="setting-input setting-input-wide"
          />
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: Course Checklists JSON ─────────────────────────────────────────────

type ChecklistPayload = {
  tasks: Record<string, any>;
  course_map: Record<string, string[]>;
};

function parseChecklistPayload(raw: string): ChecklistPayload {
  if (!raw?.trim()) return { tasks: {}, course_map: {} };

  try {
    const parsed = JSON.parse(raw);
    return {
      tasks: parsed.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {},
      course_map: parsed.course_map && typeof parsed.course_map === 'object' ? parsed.course_map : {},
    };
  } catch {
    return { tasks: {}, course_map: {} };
  }
}

function ChecklistJsonTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [checklistData, setChecklistData] = useState<ChecklistPayload>({ tasks: {}, course_map: {} });
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedAvailableTask, setSelectedAvailableTask] = useState('');
  const [selectedMappedTask, setSelectedMappedTask] = useState('');

  const rawChecklist = val(KEYS.CHECKLISTS) ?? '';

  useEffect(() => {
    const normalized = parseChecklistPayload(rawChecklist);
    setChecklistData(normalized);
    setJsonText(rawChecklist || JSON.stringify({ tasks: {}, course_map: {} }, null, 2));
    setJsonError(rawChecklist && !rawChecklist.trim() ? '' : '');
  }, [rawChecklist]);

  const courseOptions = useMemo(() => {
    const lookupText = val('course_code_lookup') ?? '';
    const lookup: Record<string, string> = {};
    lookupText.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parts = trimmed.split(' - ', 2);
      if (parts.length === 2) lookup[parts[0].trim()] = parts[1].trim();
    });

    const codes = new Set<string>([...Object.keys(checklistData.course_map), ...Object.keys(lookup)]);
    return Array.from(codes)
      .sort()
      .map((code) => ({ code, name: lookup[code] ?? '' }));
  }, [checklistData.course_map, val('course_code_lookup')]);

  useEffect(() => {
    if (!selectedCourse && courseOptions.length > 0) {
      setSelectedCourse(courseOptions[0].code);
    } else if (selectedCourse && !courseOptions.some((c) => c.code === selectedCourse)) {
      setSelectedCourse(courseOptions[0]?.code ?? '');
    }
  }, [courseOptions, selectedCourse]);

  const persistChecklist = (next: ChecklistPayload) => {
    const pretty = JSON.stringify(next, null, 2);
    setChecklistData(next);
    setJsonText(pretty);
    set(KEYS.CHECKLISTS, pretty);
    setJsonError('');
  };

  const handleAddTask = () => {
    if (!selectedCourse || !selectedAvailableTask) return;
    const existing = checklistData.course_map[selectedCourse] ?? [];
    if (existing.includes(selectedAvailableTask)) return;

    const next: ChecklistPayload = {
      ...checklistData,
      course_map: {
        ...checklistData.course_map,
        [selectedCourse]: [...existing, selectedAvailableTask],
      },
    };
    persistChecklist(next);
    setSelectedMappedTask(selectedAvailableTask);
  };

  const handleRemoveTask = () => {
    if (!selectedCourse || !selectedMappedTask) return;
    const existing = checklistData.course_map[selectedCourse] ?? [];
    const nextList = existing.filter((id) => id !== selectedMappedTask);

    const next: ChecklistPayload = {
      ...checklistData,
      course_map: {
        ...checklistData.course_map,
        [selectedCourse]: nextList,
      },
    };
    persistChecklist(next);
    setSelectedMappedTask('');
  };

  const availableTasks = Object.entries(checklistData.tasks ?? {})
    .filter(([id]) => !(checklistData.course_map[selectedCourse] ?? []).includes(id))
    .map(([id, task]) => ({ id, name: task?.name || id }));

  const mappedTasks = (checklistData.course_map[selectedCourse] ?? [])
    .map((id) => ({ id, name: checklistData.tasks?.[id]?.name || id }))
    .filter(Boolean);

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    if (!value.trim()) {
      set(KEYS.CHECKLISTS, '');
      setJsonError('');
      return;
    }

    try {
      const parsed = JSON.parse(value);
      const normalized: ChecklistPayload = {
        tasks: parsed.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {},
        course_map: parsed.course_map && typeof parsed.course_map === 'object' ? parsed.course_map : {},
      };
      setChecklistData(normalized);
      set(KEYS.CHECKLISTS, JSON.stringify(normalized, null, 2));
      setJsonError('');
    } catch {
      setJsonError('Invalid JSON. Fix it in the editor below before saving.');
    }
  };

  const handleFormat = () => {
    try {
      const parsed = jsonText ? JSON.parse(jsonText) : { tasks: {}, course_map: {} };
      const pretty = JSON.stringify(parsed, null, 2);
      setJsonText(pretty);
      set(KEYS.CHECKLISTS, pretty);
      setJsonError('');
    } catch {
      setJsonError('Unable to format invalid JSON yet.');
    }
  };

  return (
    <div className="tab-panel">
      <h2>Course Checklists</h2>
      <p className="tab-description">
        Configure the practical-task mapping for each course code in the same way as the legacy plugin.
        The raw JSON payload remains available below for full copy/paste workflows.
      </p>

      <SettingSection title="Course-to-Task Mapping">
        <SettingField
          label="Select Course"
          hint="Choose the course code to edit. This is mapped from your course code lookup and the existing checklist course_map entries."
        >
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="setting-input"
            style={{ fontFamily: 'inherit' }}
          >
            {courseOptions.length === 0 ? (
              <option value="">No course codes available yet</option>
            ) : (
              courseOptions.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code}{course.name ? ` - ${course.name}` : ''}
                </option>
              ))
            )}
          </select>
        </SettingField>

        <div className="setting-mapping-stack">
          <SettingField label="Available Practical Tasks" hint="These tasks are available in the master checklist library, but not yet mapped to the selected course.">
            <select
              value={selectedAvailableTask}
              onChange={(e) => setSelectedAvailableTask(e.target.value)}
              className="setting-select"
              size={10}
            >
              {availableTasks.length === 0 ? (
                <option value="">No unassigned tasks available</option>
              ) : (
                availableTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name} ({task.id})</option>
                ))
              )}
            </select>
          </SettingField>

          <div className="setting-mapping-actions">
            <button type="button" className="btn-save" onClick={handleAddTask} disabled={!selectedCourse || !selectedAvailableTask}>
              Add Task
            </button>
            <button type="button" className="toggle-visibility" onClick={handleRemoveTask} disabled={!selectedCourse || !selectedMappedTask}>
              Remove Task
            </button>
          </div>

          <SettingField label="Mapped Practical Tasks" hint="These are the tasks that will be generated for students taking the selected course.">
            <select
              value={selectedMappedTask}
              onChange={(e) => setSelectedMappedTask(e.target.value)}
              className="setting-select"
              size={10}
            >
              {mappedTasks.length === 0 ? (
                <option value="">No tasks mapped yet</option>
              ) : (
                mappedTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.name} ({task.id})</option>
                ))
              )}
            </select>
          </SettingField>
        </div>
      </SettingSection>

      <SettingSection title="Raw JSON (Advanced)">
        <SettingField
          label="Full Payload"
          hint="Use this only when you need to paste or copy the entire JSON blob. It is collapsed by default."
        >
          <div className="setting-json-editor">
            <div className="setting-json-actions">
              <button type="button" className="toggle-visibility" onClick={() => setShowJson((prev) => !prev)}>
                {showJson ? 'Hide JSON' : 'Show JSON'}
              </button>
              <button type="button" className="toggle-visibility" onClick={handleFormat}>
                Format JSON
              </button>
            </div>
            {showJson && (
              <>
                <textarea
                  value={jsonText}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="setting-textarea setting-textarea-large"
                  rows={24}
                  spellCheck={false}
                  placeholder={`{"tasks": {}, "course_map": {}}`}
                />
                {jsonError && <p className="setting-json-error">{jsonError}</p>}
              </>
            )}
          </div>
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: Practical Tasks ────────────────────────────────────────────────────

function PracticalTasksTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [selectedSubElementId, setSelectedSubElementId] = useState('');
  const [editModal, setEditModal] = useState<{ type: 'task' | 'element' | 'subelement'; taskId: string; elementId?: string; subelementId?: string; value: string; title: string } | null>(null);
  const payload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');
  const tasks = payload.tasks ?? {};

  const taskEntries = Object.entries<any>(tasks).map(([id, task]) => ({ id, name: task?.name || id }));
  const selectedTask = selectedTaskId ? tasks[selectedTaskId] : null;
  const elementEntries = Object.entries<any>(selectedTask?.elements ?? {}).map(([id, element]) => ({
    id,
    name: element?.title || element?.name || id,
  }));
  const selectedElement = selectedTask?.elements?.[selectedElementId] ?? null;
  const subElementEntries = Object.entries<any>(selectedElement?.sub_elements ?? {}).map(([id, sub]) => ({
    id,
    name: typeof sub === 'string' ? sub : sub?.name || id,
  }));

  const ensureSelection = () => {
    if (!selectedTaskId && taskEntries.length > 0) {
      setSelectedTaskId(taskEntries[0].id);
    }
    if (selectedTaskId && !tasks[selectedTaskId] && taskEntries.length > 0) {
      setSelectedTaskId(taskEntries[0].id);
    }
  };

  useEffect(() => {
    ensureSelection();
  }, [selectedTaskId, taskEntries, tasks]);

  useEffect(() => {
    if (selectedTaskId && selectedTask && !Object.prototype.hasOwnProperty.call(selectedTask.elements ?? {}, selectedElementId)) {
      setSelectedElementId('');
      setSelectedSubElementId('');
    }
  }, [selectedTaskId, selectedElementId, selectedTask]);

  const commitPayload = (nextPayload: ChecklistPayload) => {
    set(KEYS.CHECKLISTS, JSON.stringify(nextPayload, null, 2));
  };

  const toLetter = (index: number) => {
    let result = '';
    let n = index;
    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(97 + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };

  const nextNumericKey = (existingKeys: string[]) => {
    const numbers = existingKeys.map((key) => Number(key)).filter((value) => Number.isFinite(value));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return String(next);
  };

  const nextLetterKey = (existingKeys: string[]) => {
    let index = 1;
    while (existingKeys.includes(toLetter(index))) {
      index += 1;
    }
    return toLetter(index);
  };

  const handleAddTask = () => {
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');
    const nextId = `PT_NEW_${Object.keys(nextPayload.tasks).length + 1}`;
    nextPayload.tasks[nextId] = {
      name: 'New Practical Task',
      elements: {
        '1': {
          title: 'New Element',
          sub_elements: { a: 'New Sub-Element' },
        },
      },
    };
    commitPayload(nextPayload);
    setSelectedTaskId(nextId);
    setSelectedElementId('1');
    setSelectedSubElementId('a');
  };

  const handleAddElement = () => {
    if (!selectedTaskId) return;
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');
    const task = nextPayload.tasks[selectedTaskId];
    if (!task) return;
    const existingKeys = Object.keys(task.elements ?? {});
    const nextId = nextNumericKey(existingKeys);
    task.elements = task.elements ?? {};
    task.elements[nextId] = {
      title: 'New Element',
      sub_elements: { a: 'New Sub-Element' },
    };
    commitPayload(nextPayload);
    setSelectedElementId(nextId);
    setSelectedSubElementId('a');
  };

  const handleAddSubElement = () => {
    if (!selectedTaskId || !selectedElementId) return;
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');
    const task = nextPayload.tasks[selectedTaskId];
    const element = task?.elements?.[selectedElementId];
    if (!task || !element) return;
    const existingKeys = Object.keys(element.sub_elements ?? {});
    const nextId = nextLetterKey(existingKeys);
    element.sub_elements = element.sub_elements ?? {};
    element.sub_elements[nextId] = 'New Sub-Element';
    commitPayload(nextPayload);
    setSelectedSubElementId(nextId);
  };

  const handleEdit = (type: 'task' | 'element' | 'subelement') => {
    if (type === 'task' && selectedTaskId) {
      setEditModal({ type, taskId: selectedTaskId, value: tasks[selectedTaskId]?.name || '', title: 'Edit Task Name' });
      return;
    }
    if (type === 'element' && selectedTaskId && selectedElementId) {
      setEditModal({ type, taskId: selectedTaskId, elementId: selectedElementId, value: selectedElement?.title || selectedElement?.name || '', title: 'Edit Element Title' });
      return;
    }
    if (type === 'subelement' && selectedTaskId && selectedElementId && selectedSubElementId) {
      setEditModal({ type, taskId: selectedTaskId, elementId: selectedElementId, subelementId: selectedSubElementId, value: selectedElement?.sub_elements?.[selectedSubElementId] || '', title: 'Edit Sub-Element Text' });
    }
  };

  const handleDuplicate = (type: 'task' | 'element' | 'subelement') => {
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');

    if (type === 'task' && selectedTaskId) {
      const baseTask = nextPayload.tasks[selectedTaskId];
      const nextId = `PT_COPY_${Object.keys(nextPayload.tasks).length + 1}`;
      nextPayload.tasks[nextId] = {
        ...baseTask,
        name: `COPY OF ${baseTask.name || selectedTaskId}`,
      };
      commitPayload(nextPayload);
      setSelectedTaskId(nextId);
      setSelectedElementId('');
      setSelectedSubElementId('');
      return;
    }

    if (type === 'element' && selectedTaskId && selectedElementId) {
      const task = nextPayload.tasks[selectedTaskId];
      const element = task?.elements?.[selectedElementId];
      if (!task || !element) return;
      const existingKeys = Object.keys(task.elements ?? {});
      const nextId = nextNumericKey(existingKeys);
      task.elements = task.elements ?? {};
      task.elements[nextId] = {
        ...element,
        title: `${element.title || element.name || selectedElementId} (COPY)`,
      };
      commitPayload(nextPayload);
      setSelectedElementId(nextId);
      setSelectedSubElementId('');
      return;
    }

    if (type === 'subelement' && selectedTaskId && selectedElementId && selectedSubElementId) {
      const task = nextPayload.tasks[selectedTaskId];
      const element = task?.elements?.[selectedElementId];
      const currentValue = element?.sub_elements?.[selectedSubElementId];
      if (!task || !element || currentValue === undefined) return;
      const existingKeys = Object.keys(element.sub_elements ?? {});
      const nextId = nextLetterKey(existingKeys);
      element.sub_elements = element.sub_elements ?? {};
      element.sub_elements[nextId] = `${currentValue} (COPY)`;
      commitPayload(nextPayload);
      setSelectedSubElementId(nextId);
    }
  };

  const handleRemove = (type: 'task' | 'element' | 'subelement') => {
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');

    if (type === 'task' && selectedTaskId) {
      delete nextPayload.tasks[selectedTaskId];
      Object.values(nextPayload.course_map).forEach((taskIds) => {
        if (Array.isArray(taskIds)) {
          const index = taskIds.indexOf(selectedTaskId);
          if (index >= 0) taskIds.splice(index, 1);
        }
      });
      commitPayload(nextPayload);
      setSelectedTaskId('');
      setSelectedElementId('');
      setSelectedSubElementId('');
      return;
    }

    if (type === 'element' && selectedTaskId && selectedElementId) {
      const task = nextPayload.tasks[selectedTaskId];
      if (!task?.elements) return;
      delete task.elements[selectedElementId];
      const reindexed: Record<string, any> = {};
      Object.keys(task.elements).sort((a, b) => Number(a) - Number(b)).forEach((key, index) => {
        reindexed[String(index + 1)] = task.elements[key];
      });
      task.elements = reindexed;
      commitPayload(nextPayload);
      setSelectedElementId('');
      setSelectedSubElementId('');
      return;
    }

    if (type === 'subelement' && selectedTaskId && selectedElementId && selectedSubElementId) {
      const task = nextPayload.tasks[selectedTaskId];
      const element = task?.elements?.[selectedElementId];
      if (!element?.sub_elements) return;
      delete element.sub_elements[selectedSubElementId];
      const reindexed: Record<string, any> = {};
      Object.keys(element.sub_elements).sort().forEach((key, index) => {
        reindexed[toLetter(index + 1)] = element.sub_elements[key];
      });
      element.sub_elements = reindexed;
      commitPayload(nextPayload);
      setSelectedSubElementId('');
    }
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    const nextPayload = parseChecklistPayload(val(KEYS.CHECKLISTS) ?? '');
    if (editModal.type === 'task') {
      const task = nextPayload.tasks[editModal.taskId];
      if (task) task.name = editModal.value;
    } else if (editModal.type === 'element') {
      const task = nextPayload.tasks[editModal.taskId];
      const element = task?.elements?.[editModal.elementId ?? ''];
      if (element) {
        element.title = editModal.value;
      }
    } else if (editModal.type === 'subelement') {
      const task = nextPayload.tasks[editModal.taskId];
      const element = task?.elements?.[editModal.elementId ?? ''];
      if (element?.sub_elements) {
        element.sub_elements[editModal.subelementId ?? ''] = editModal.value;
      }
    }
    commitPayload(nextPayload);
    setEditModal(null);
  };

  return (
    <div className="tab-panel">
      <h2>Practical Tasks</h2>
      <p className="tab-description">
        Manage the master task library with the same hierarchy and action buttons as the legacy plugin.
      </p>

      <div className="setting-task-stack">
        <div className="setting-task-column">
          <h3>1. Practical Tasks</h3>
          <select
            className="setting-select"
            size={12}
            value={selectedTaskId}
            onChange={(e) => {
              setSelectedTaskId(e.target.value);
              setSelectedElementId('');
              setSelectedSubElementId('');
            }}
          >
            {taskEntries.length === 0 ? (
              <option value="">No tasks available</option>
            ) : (
              taskEntries.map((task) => (
                <option key={task.id} value={task.id}>{task.name} ({task.id})</option>
              ))
            )}
          </select>
          <div className="setting-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn-save" onClick={handleAddTask}>Add New</button>
            <button type="button" className="toggle-visibility" onClick={() => handleEdit('task')} disabled={!selectedTaskId}>Edit Text</button>
            <button type="button" className="toggle-visibility" onClick={() => handleDuplicate('task')} disabled={!selectedTaskId}>Duplicate</button>
            <button type="button" className="toggle-visibility" onClick={() => handleRemove('task')} disabled={!selectedTaskId}>Remove</button>
          </div>
        </div>

        <div className="setting-task-column">
          <h3>2. Main Elements</h3>
          <select
            className="setting-select"
            size={12}
            value={selectedElementId}
            onChange={(e) => setSelectedElementId(e.target.value)}
            disabled={!selectedTaskId}
          >
            {elementEntries.length === 0 ? (
              <option value="">No elements available</option>
            ) : (
              elementEntries.map((element) => (
                <option key={element.id} value={element.id}>{element.id}: {element.name}</option>
              ))
            )}
          </select>
          <div className="setting-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn-save" onClick={handleAddElement} disabled={!selectedTaskId}>Add New</button>
            <button type="button" className="toggle-visibility" onClick={() => handleEdit('element')} disabled={!selectedTaskId || !selectedElementId}>Edit Text</button>
            <button type="button" className="toggle-visibility" onClick={() => handleDuplicate('element')} disabled={!selectedTaskId || !selectedElementId}>Duplicate</button>
            <button type="button" className="toggle-visibility" onClick={() => handleRemove('element')} disabled={!selectedTaskId || !selectedElementId}>Remove</button>
          </div>
        </div>

        <div className="setting-task-column">
          <h3>3. Sub-Elements</h3>
          <select
            className="setting-select"
            size={12}
            value={selectedSubElementId}
            onChange={(e) => setSelectedSubElementId(e.target.value)}
            disabled={!selectedElementId}
          >
            {subElementEntries.length === 0 ? (
              <option value="">No sub-elements available</option>
            ) : (
              subElementEntries.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.id}: {sub.name}</option>
              ))
            )}
          </select>
          <div className="setting-action-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn-save" onClick={handleAddSubElement} disabled={!selectedTaskId || !selectedElementId}>Add New</button>
            <button type="button" className="toggle-visibility" onClick={() => handleEdit('subelement')} disabled={!selectedTaskId || !selectedElementId || !selectedSubElementId}>Edit Text</button>
            <button type="button" className="toggle-visibility" onClick={() => handleDuplicate('subelement')} disabled={!selectedTaskId || !selectedElementId || !selectedSubElementId}>Duplicate</button>
            <button type="button" className="toggle-visibility" onClick={() => handleRemove('subelement')} disabled={!selectedTaskId || !selectedElementId || !selectedSubElementId}>Remove</button>
          </div>
        </div>
      </div>

      {editModal && (
        <div className="setting-edit-modal-overlay" onClick={() => setEditModal(null)}>
          <div className="setting-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{editModal.title}</h4>
            <textarea
              value={editModal.value}
              onChange={(e) => setEditModal((prev) => prev ? { ...prev, value: e.target.value } : prev)}
              rows={8}
              className="setting-textarea"
            />
            <div className="setting-action-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn-save" onClick={handleSaveEdit}>Save</button>
              <button type="button" className="toggle-visibility" onClick={() => setEditModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Success Comments ────────────────────────────────────────────────────
// Port of PHP success_comments_field_callback
// Stored as JSON: { PT_ID: string[], _default: string[] }

function SuccessCommentsTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [selectedPt, setSelectedPt] = useState('_default');
  const [comments, setComments] = useState<Record<string, string[]>>({});
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const raw = val('success_comments');
    if (raw) {
      try { setComments(JSON.parse(raw)); } catch { setComments({}); }
    }
  }, [val]);

  useEffect(() => {
    const pool = comments[selectedPt] ?? [];
    setEditText(pool.join('\n'));
  }, [selectedPt, comments]);

  const handleSavePool = () => {
    const lines = editText.split('\n').map((l) => l.trim()).filter(Boolean);
    const next = { ...comments, [selectedPt]: lines };
    setComments(next);
    set('success_comments', JSON.stringify(next));
  };

  // Build list of PT IDs from checklists setting if available
  const checklistRaw = val('observation_checklists');
  let ptIds: string[] = ['_default'];
  if (checklistRaw) {
    try {
      const master = JSON.parse(checklistRaw);
      ptIds = ['_default', ...Object.keys(master.tasks ?? {})];
    } catch { /* use default */ }
  }

  return (
    <div className="tab-panel">
      <h2>Success Comments</h2>
      <p className="tab-description">
        Configure pools of success comments that trainers can pull from when marking tasks satisfactory.
        Configure a global default, and optionally per-task pools. One comment per line.
      </p>
      <SettingSection title="Comment Pools">
        <SettingField label="Select Task" hint="Choose a practical task to edit its comment pool, or edit the global default.">
          <select
            value={selectedPt}
            onChange={(e) => setSelectedPt(e.target.value)}
            className="setting-input"
            style={{ fontFamily: 'inherit' }}
          >
            {ptIds.map((id) => (
              <option key={id} value={id}>{id === '_default' ? 'Global Default' : id}</option>
            ))}
          </select>
        </SettingField>
        <SettingField label="Comments" hint="One comment per line. Trainers will get a random comment from this pool.">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="setting-textarea"
            rows={10}
            placeholder={'Great job demonstrating this skill.\nExcellent technique shown throughout.'}
          />
          <button
            type="button"
            style={{ marginTop: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
            onClick={handleSavePool}
          >
            Save Pool (then click Save Changes above)
          </button>
        </SettingField>
      </SettingSection>
    </div>
  );
}

// ─── Tab: WordPress Sync ──────────────────────────────────────────────────────

function WpSyncTab({ val, set }: { val: (k: string) => string; set: (k: string, v: string) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [tableOrder, setTableOrder] = useState<string[]>([]);
  const [tableProgress, setTableProgress] = useState<Record<string, { total: number; current: number; imported: number; error?: string }>>({});
  const [finalResult, setFinalResult] = useState<{ summary: Record<string, number>; errors: string[] } | null>(null);
  const [syncError, setSyncError] = useState('');
  const [showToken, setShowToken] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  const handleSync = async () => {
    abortRef.current?.abort();
    setSyncing(true);
    setTableOrder([]);
    setTableProgress({});
    setFinalResult(null);
    setSyncError('');

    const token = localStorage.getItem('token');
    const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const response = await fetch(`${baseURL}/wp-sync/stream`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
        signal: ctrl.signal,
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!;
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'table_start') {
                setTableOrder(prev => [...prev, event.table]);
                setTableProgress(prev => ({ ...prev, [event.table]: { total: event.total, current: 0, imported: 0 } }));
              } else if (event.type === 'progress') {
                setTableProgress(prev => ({ ...prev, [event.table]: { total: event.total, current: event.offset, imported: event.imported } }));
              } else if (event.type === 'table_error') {
                setTableProgress(prev => ({ ...prev, [event.table]: { ...prev[event.table], error: event.message } }));
              } else if (event.type === 'done') {
                setFinalResult({ summary: event.summary, errors: event.errors });
              } else if (event.type === 'error') {
                setSyncError(event.message);
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setSyncError(err?.message ?? 'Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="tab-panel">
      <h2>WordPress Sync</h2>
      <p className="tab-description">
        One-way sync from the WordPress trainer portal database into lsfa-central.
        Use this during the transition period to keep workshop progress, checklists, and uploads in sync.
        <br /><br />
        <strong>Required:</strong> Install the <code>lsfa-sync-export</code> plugin on the WordPress site first, then configure its secret token here.
      </p>

      <SettingSection title="Connection">
        <SettingField label="WordPress Site URL" hint="The full URL of the WordPress site. e.g. https://lifesavingfirstaid.com.au">
          <input
            type="url"
            value={val(KEYS.WP_SYNC_URL)}
            onChange={(e) => set(KEYS.WP_SYNC_URL, e.target.value)}
            placeholder="https://lifesavingfirstaid.com.au"
            className="setting-input setting-input-wide"
          />
        </SettingField>
        <SettingField label="Secret Token" hint="Must match the token configured in the LSFA Sync Export WordPress plugin.">
          <div className="input-with-toggle">
            <input
              type={showToken ? 'text' : 'password'}
              value={val(KEYS.WP_SYNC_TOKEN)}
              onChange={(e) => set(KEYS.WP_SYNC_TOKEN, e.target.value)}
              placeholder="Secret token from WordPress plugin"
              className="setting-input setting-input-wide"
            />
            <button type="button" className="toggle-visibility" onClick={() => setShowToken(v => !v)}>
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
        </SettingField>
      </SettingSection>

      <SettingSection title="Run Sync">
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            Syncs: <strong>workshop progress</strong>, <strong>student checklists</strong>, <strong>workshop snapshots</strong>, and <strong>file upload records</strong>.
            Existing records are updated; new records are created. Nothing is deleted.
          </p>
          <button
            className="btn-save"
            onClick={handleSync}
            disabled={syncing || !val(KEYS.WP_SYNC_URL) || !val(KEYS.WP_SYNC_TOKEN)}
            style={{ marginBottom: 16 }}
          >
            {syncing ? '⟳ Syncing...' : 'Sync from WordPress'}
          </button>

          {syncError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              {syncError}
            </div>
          )}

          {tableOrder.length > 0 && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
              {tableOrder.map(table => {
                const p = tableProgress[table];
                if (!p) return null;
                const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
                const isDone = p.current >= p.total && p.total > 0;
                return (
                  <div key={table} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13, fontFamily: 'monospace' }}>
                    <span style={{ width: 190, color: '#334155', flexShrink: 0 }}>{table.replace(/_/g, ' ')}</span>
                    {p.error ? (
                      <span style={{ color: '#dc2626' }}>✗ error</span>
                    ) : (
                      <>
                        <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, background: isDone ? '#16a34a' : '#3b82f6', height: '100%', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ color: '#64748b', width: 100, textAlign: 'right', flexShrink: 0 }}>
                          {p.current.toLocaleString()}/{p.total.toLocaleString()}
                        </span>
                        <span style={{ color: '#475569', width: 80, flexShrink: 0 }}>
                          {p.imported.toLocaleString()} synced
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
              {syncing && tableOrder.length === 0 && (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Connecting...</span>
              )}
            </div>
          )}

          {finalResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: 8 }}>✓ Sync complete</div>
              <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(finalResult.summary).map(([key, count]) => (
                    <tr key={key}>
                      <td style={{ padding: '2px 16px 2px 0', color: '#475569' }}>{key.replace(/_/g, ' ')}</td>
                      <td style={{ fontWeight: 600, color: '#166534' }}>{count.toLocaleString()} rows synced</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {finalResult.errors.length > 0 && (
                <div style={{ marginTop: 10, color: '#92400e', fontSize: 12 }}>
                  <strong>Warnings ({finalResult.errors.length}):</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {finalResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}

// ─── Placeholder tab ─────────────────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="tab-panel">
      <h2>{label}</h2>
      <div className="tab-placeholder">
        <p>This tab will be configured when the relevant feature is built.</p>
      </div>
    </div>
  );
}

// ─── Shared layout components ─────────────────────────────────────────────────

function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="setting-section">
      <h3 className="setting-section-title">{title}</h3>
      <div className="setting-section-body">{children}</div>
    </div>
  );
}

function SettingField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-field">
      <div className="setting-label-col">
        <label className="setting-label">{label}</label>
        {hint && <p className="setting-hint">{hint}</p>}
      </div>
      <div className="setting-input-col">{children}</div>
    </div>
  );
}
