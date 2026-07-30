import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { contactsApi } from '../api';

type Tab = 'personal' | 'avetmiss' | 'declarations';

export const indigenousStatusOptions = [
  { value: "4", label: "No, Neither Aboriginal Nor Torres Strait Islander" },
  { value: "1", label: "Yes, Aboriginal" },
  { value: "2", label: "Yes, Torres Strait Islander" },
  { value: "3", label: "Yes, Aboriginal AND Torres Strait Islander" },
  { value: "@", label: "Not specified" } 
];

export const highestSchoolLevelCompletedOptions = [
  { value: "12", label: "Year 12 or equivalent" },
  { value: "11", label: "Year 11 or equivalent" },
  { value: "10", label: "Year 10 or equivalent" },
  { value: "09", label: "Year 9 or equivalent" },
  { value: "08", label: "Year 8 or below" },
  { value: "02", label: "Did not go to school" },
  { value: "@@", label: "Not specified" }
];

export const labourForceStatusOptions = [
  { value: "01", label: "Full-time employee" },
  { value: "02", label: "Part-time employee" },
  { value: "03", label: "Self employed – not employing others" },
  { value: "04", label: "Self employed – employing others" },
  { value: "05", label: "Employed – unpaid worker in a family business" },
  { value: "06", label: "Unemployed – seeking full-time work" },
  { value: "07", label: "Unemployed – seeking part-time work" },
  { value: "08", label: "Not employed – not seeking employment" },
  { value: "@@", label: "Not specified" }
];

export const mainLanguageSpokenOptions = [
  { value: "1201", label: "English" },
  { value: "0000", label: "Other - Not specified" }
];

export const citizenshipStatusOptions = [
  { value: "Australian Citizen", label: "Australian Citizen" },
  { value: "Permanent Resident", label: "Permanent Resident" },
  { value: "Temporary Visa", label: "Temporary Visa" },
  { value: "Other", label: "Other" }
];

export function MyDetailsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadContact();
  }, []);

  const loadContact = async () => {
    setLoading(true);
    try {
      const res = await contactsApi.getMyContact();
      setFormData(res.data || {});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load student contact details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await contactsApi.updateMyContact(formData);
      toast.success('Student contact details saved successfully');
      loadContact();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save contact details');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncAxcelerate = async () => {
    setSyncing(true);
    try {
      await contactsApi.syncAxcelerate();
      toast.success('Details successfully re-synced from Axcelerate');
      loadContact();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sync with Axcelerate');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading student details...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>My Student Details</h1>
          <p style={{ color: '#64748b', marginTop: 4, marginBottom: 0 }}>
            View and update your AVETMISS compliant student contact record (Contact ID: #{formData.contactId ?? 'N/A'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={handleSyncAxcelerate} style={secondaryButtonStyle} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync from Axcelerate'}
          </button>
          <button type="button" onClick={handleSave} style={primaryButtonStyle} disabled={saving}>
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 24, overflowX: 'auto' }}>
        <TabButton label="Personal Details & Contact" active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} />
        <TabButton label="AVETMISS & Education" active={activeTab === 'avetmiss'} onClick={() => setActiveTab('avetmiss')} />
        <TabButton label="Declarations & Custom" active={activeTab === 'declarations'} onClick={() => setActiveTab('declarations')} />
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave}>
        <div style={cardStyle}>
          {activeTab === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Personal Details</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input style={inputStyle} value={formData.givenName || ''} onChange={(e) => handleChange('givenName', e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Middle Name</label>
                  <input style={inputStyle} value={formData.middleName || ''} onChange={(e) => handleChange('middleName', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input style={inputStyle} value={formData.surname || ''} onChange={(e) => handleChange('surname', e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Date of Birth (YYYY-MM-DD)</label>
                  <input style={inputStyle} type="date" value={formData.dob || ''} onChange={(e) => handleChange('dob', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Gender / Sex</label>
                  <select style={inputStyle} value={formData.sex || ''} onChange={(e) => handleChange('sex', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="X">Indeterminate / Intersex / Unspecified (X)</option>
                  </select>
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Unique Student Identifier (USI)</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>USI Number</label>
                  <input style={inputStyle} value={formData.usi || ''} onChange={(e) => handleChange('usi', e.target.value)} placeholder="10-character code e.g. X22CDX2MGT" />
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!formData.usiVerified} onChange={(e) => handleChange('usiVerified', e.target.checked)} />
                    USI Verified
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!formData.usiExemption} onChange={(e) => handleChange('usiExemption', e.target.checked)} />
                    USI Exempt
                  </label>
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Contact Channels</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input style={inputStyle} type="email" value={formData.emailAddress || ''} onChange={(e) => handleChange('emailAddress', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Mobile Phone</label>
                  <input style={inputStyle} value={formData.mobilePhone || ''} onChange={(e) => handleChange('mobilePhone', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Home / Work Phone</label>
                  <input style={inputStyle} value={formData.phone || formData.workPhone || ''} onChange={(e) => handleChange('mobilePhone', e.target.value)} />
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Residential Address</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Building Name / Unit No.</label>
                  <input style={inputStyle} value={formData.unitNo || ''} onChange={(e) => handleChange('unitNo', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Street Number & Name</label>
                  <input style={inputStyle} value={formData.address1 || ''} onChange={(e) => handleChange('address1', e.target.value)} placeholder="24 Peridot Cres" />
                </div>
                <div>
                  <label style={labelStyle}>Suburb / City</label>
                  <input style={inputStyle} value={formData.city || ''} onChange={(e) => handleChange('city', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={formData.state || ''} onChange={(e) => handleChange('state', e.target.value)} placeholder="QLD" />
                </div>
                <div>
                  <label style={labelStyle}>Postcode</label>
                  <input style={inputStyle} value={formData.postcode || ''} onChange={(e) => handleChange('postcode', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input style={inputStyle} value={formData.country || ''} onChange={(e) => handleChange('country', e.target.value)} placeholder="Australia" />
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Emergency Contact Information</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Emergency Contact Full Name</label>
                  <input style={inputStyle} value={formData.emergencyContact || ''} onChange={(e) => handleChange('emergencyContact', e.target.value)} placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Relationship to Student</label>
                  <input style={inputStyle} value={formData.emergencyContactRelation || ''} onChange={(e) => handleChange('emergencyContactRelation', e.target.value)} placeholder="e.g. Spouse, Parent, Partner" />
                </div>
                <div>
                  <label style={labelStyle}>Emergency Phone Number</label>
                  <input style={inputStyle} value={formData.emergencyContactPhone || ''} onChange={(e) => handleChange('emergencyContactPhone', e.target.value)} placeholder="e.g. 0412345678" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'avetmiss' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Demographics & AVETMISS</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Citizenship Status</label>
                  <select style={inputStyle} value={formData.citizenStatusName || ''} onChange={(e) => handleChange('citizenStatusName', e.target.value)}>
                    <option value="">Select...</option>
                    {citizenshipStatusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Country of Birth</label>
                  <input style={inputStyle} value={formData.countryOfBirthName || ''} onChange={(e) => handleChange('countryOfBirthName', e.target.value)} placeholder="Australia" />
                </div>
                <div>
                  <label style={labelStyle}>Main Language Spoken at Home</label>
                  <select style={inputStyle} value={formData.mainLanguageName || ''} onChange={(e) => handleChange('mainLanguageName', e.target.value)}>
                    <option value="">Select...</option>
                    {mainLanguageSpokenOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Indigenous Status</label>
                  <select style={inputStyle} value={formData.indigenousStatusName || ''} onChange={(e) => handleChange('indigenousStatusName', e.target.value)}>
                    <option value="">Select...</option>
                    {indigenousStatusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Schooling & Prior Education</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Highest School Level Attained</label>
                  <select style={inputStyle} value={String(formData.highestSchoolLevelId) || ''} onChange={(e) => handleChange('highestSchoolLevelId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {highestSchoolLevelCompletedOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Year Highest School Level Completed</label>
                  <input style={inputStyle} value={formData.highestSchoolLevelYear || ''} onChange={(e) => handleChange('highestSchoolLevelYear', e.target.value)} placeholder="e.g. 1994" />
                </div>
                <div>
                  <label style={labelStyle}>Labour Force Status</label>
                  <select style={inputStyle} value={formData.labourForceName || ''} onChange={(e) => handleChange('labourForceName', e.target.value)}>
                    <option value="">Select...</option>
                    {labourForceStatusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Job Title / Occupation</label>
                  <input style={inputStyle} value={formData.customFieldJobTitle || ''} onChange={(e) => handleChange('customFieldJobTitle', e.target.value)} placeholder="Project Manager, etc." />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'declarations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Course Custom Declarations & Preferences</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Additional Support Required</label>
                  <input style={inputStyle} value={formData.customFieldAdditionalSupport || ''} onChange={(e) => handleChange('customFieldAdditionalSupport', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>USI Transcript Access Permission</label>
                  <input style={inputStyle} value={formData.customFieldUsiPermission || ''} onChange={(e) => handleChange('customFieldUsiPermission', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Marketing Permission</label>
                  <input style={inputStyle} value={formData.customFieldMarketingPermission || ''} onChange={(e) => handleChange('customFieldMarketingPermission', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Combined Declaration Acceptance</label>
                  <input style={inputStyle} value={formData.customFieldCombinedDeclaration || ''} onChange={(e) => handleChange('customFieldCombinedDeclaration', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <button type="submit" style={primaryButtonStyle} disabled={saving}>
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        border: 'none',
        background: 'transparent',
        borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
        color: active ? '#2563eb' : '#64748b',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  padding: 24,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#0f172a',
  margin: '0 0 12px 0',
  paddingBottom: 8,
  borderBottom: '1px solid #f1f5f9',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  padding: '10px 16px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};