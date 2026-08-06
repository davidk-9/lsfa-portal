import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AsyncSelect from 'react-select/async';
import { contactsApi, usersApi, settingsApi } from '../api';
import api from '../api/client';
import { saccOptions } from '../utils/sacc';
import { asclOptions } from '../utils/ascl';
import { useToast } from '../context/ToastContext';

type Tab = 'personal' | 'avetmiss' | 'declarations' | 'linked-user';

// Modal Backdrop Style
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  background: 'white',
  padding: '24px',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '600px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

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

export const studyReasonOptions = [
  { value: "01", label: "To get a job" },
  { value: "02", label: "To develop my existing business" },
  { value: "03", label: "To start my own business" },
  { value: "04", label: "To try for a different career" },
  { value: "05", label: "To get a better job or promotion" },
  { value: "06", label: "It was a requirement of my job" },
  { value: "07", label: "I wanted extra skills for my job" },
  { value: "08", label: "To get into another course of study" },
  { value: "12", label: "For personal interest or self-development" },
  { value: "13", label: "To get skills for community/voluntary work" },
  { value: "11", label: "Other reasons" },
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

export const englishProficiencyOptions = [
  { value: "1", label: "Very well" },
  { value: "2", label: "Well" },
  { value: "3", label: "Not well" },
  { value: "4", label: "Not at all" }
];

export const priorEducationOptions = [
  { value: "008", label: "Bachelor Degree or Higher Degree level" },
  { value: "410", label: "Advanced Diploma or Associate Degree Level" },
  { value: "420", label: "Diploma Level" },
  { value: "511", label: "Certificate IV" },
  { value: "514", label: "Certificate III" },
  { value: "521", label: "Certificate II" },
  { value: "524", label: "Certificate I" },
  { value: "990", label: "Miscellaneous Education" }
];

export const disabilityOptions = [
  { value: "11", label: "Hearing/Deaf" },
  { value: "12", label: "Physical" },
  { value: "13", label: "Intellectual" },
  { value: "14", label: "Learning" },
  { value: "15", label: "Mental Illness" },
  { value: "16", label: "Acquired Brain Impairment" },
  { value: "17", label: "Vision" },
  { value: "18", label: "Medical Condition" },
  { value: "19", label: "Other" }
];

export const cJobTitleOptions = [
  "Not Employed",
  "Teacher",
  "Aged Care Support Worker",
  "Aged Care Support Worker (Qualified)",
  "Child Care Worker",
  "Child Care Worker (Qualified)",
  "Disability Support Worker",
  "Disability Support Worker (Qualified)",
  "Other"
];

const USI_REGEX = /^[2-9A-HJ-NP-Z]{10}$/i;

function formatUsiMatchResults(data: any, msg?: string): string {
  if (msg) return msg;
  if (!data) return 'USI verification failed. Please check details and try again.';
  const issues: string[] = [];
  if (data.firstName === 'NO_MATCH') issues.push('First Name does not match');
  if (data.lastName === 'NO_MATCH') issues.push('Last Name does not match');
  if (data.dateOfBirth === 'NO_MATCH') issues.push('Date of Birth does not match');
  if (data.usiStatus && data.usiStatus !== 'Valid') issues.push(`USI Status: ${data.usiStatus}`);
  if (issues.length > 0) {
    return `USI Verification Failed: ${issues.join(', ')}.`;
  }
  return 'USI verification failed. Please check details and try again.';
}

export function ContactDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const contactIdNum = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Address UI State Toggle
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempAddress, setTempAddress] = useState<any>({});

  const [formData, setFormData] = useState<any>({});
  const [verifyingUsi, setVerifyingUsi] = useState(false);
  const [usiFeedback, setUsiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [courseCodeOptions, setCourseCodeOptions] = useState<string[]>([]);

  // Linked User tab state
  const [linkedUser, setLinkedUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [customPassword, setCustomPassword] = useState<string>('');
  const [userActionLoading, setUserActionLoading] = useState(false);

  useEffect(() => {
    loadContact();
    loadUsers();
    loadCourseCodes();
  }, [contactIdNum]);

  const loadCourseCodes = async () => {
    try {
      const res = await settingsApi.getCourseCodes();
      if (Array.isArray(res.data) && res.data.length > 0) {
        setCourseCodeOptions(res.data.map((c: any) => `${c.code} - ${c.name}`));
      } else {
        setCourseCodeOptions([
          "HLTAID009 - Provide CPR",
          "HLTAID010 - Basic Life Support",
          "HLTAID011 - Provide First Aid"
        ]);
      }
    } catch (err) {
      setCourseCodeOptions([
        "HLTAID009 - Provide CPR",
        "HLTAID010 - Basic Life Support",
        "HLTAID011 - Provide First Aid"
      ]);
    }
  };

  const loadContact = async () => {
    if (!contactIdNum) return;
    setLoading(true);
    try {
      const res = await contactsApi.getById(contactIdNum);
      const data = res.data || {};
      setFormData(data);
      setLinkedUser(data.user || null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await usersApi.list();
      setAllUsers(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch (err) {
      console.error('Failed to load users for linking', err);
      setAllUsers([]);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (idField: string, nameField: string, options: { value: string; label: string }[], selectedValue: string) => {
    const foundOpt = options.find((o) => o.value === selectedValue);
    setFormData((prev: any) => ({
      ...prev,
      [idField]: selectedValue ? (isNaN(Number(selectedValue)) ? selectedValue : Number(selectedValue)) : null,
      [nameField]: foundOpt ? foundOpt.label : '',
    }));
  };

  const toggleArrayField = (field: string, optVal: string, checked: boolean) => {
    setFormData((prev: any) => {
      const currentList: string[] = prev[field] || [];
      let updated: string[];
      if (checked) {
        if (!currentList.some(item => item === optVal || item.startsWith(optVal))) {
          updated = [...currentList, optVal];
        } else {
          updated = [...currentList];
        }
      } else {
        updated = currentList.filter(item => item !== optVal && !item.startsWith(optVal));
      }
      return { ...prev, [field]: updated };
    });
  };

  const isArrayFieldSelected = (field: string, optVal: string): boolean => {
    const currentList: string[] = formData[field] || [];
    return currentList.some(item => item === optVal || item.startsWith(optVal));
  };

  const handleVerifyUsi = async () => {
    const rawUsi = (formData.usi || '').trim().toUpperCase();
    if (!USI_REGEX.test(rawUsi)) {
      toast.error('USI must be exactly 10 valid characters');
      return;
    }

    setVerifyingUsi(true);
    setUsiFeedback(null);
    try {
      await contactsApi.updateById(contactIdNum, { ...formData, usi: rawUsi });

      const res = await contactsApi.verifyContactUsi(contactIdNum, rawUsi);
      const { verified, data, msg } = res.data;

      if (verified) {
        handleChange('usiVerified', true);
        toast.success('USI verified successfully!');
        setUsiFeedback({
          type: 'success',
          message: 'USI verified successfully against official Australian USI records.',
        });
      } else {
        handleChange('usiVerified', false);
        const errMsg = formatUsiMatchResults(data, msg);
        toast.error(errMsg);
        setUsiFeedback({
          type: 'error',
          message: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to verify USI';
      toast.error(errMsg);
      setUsiFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setVerifyingUsi(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (formData.priorEducationStatus === true) {
      if (!formData.priorEducationIds || formData.priorEducationIds.length === 0) {
        toast.error('Prior Education is set to Yes. Please select at least one type of prior education qualification.');
        return;
      }
    }

    if (formData.disabilityFlag === true) {
      if (!formData.disabilityTypeIds || formData.disabilityTypeIds.length === 0) {
        toast.error('Disabilities is set to Yes. Please select at least one applicable disability type.');
        return;
      }
    }

    setSaving(true);
    try {
      await contactsApi.updateById(contactIdNum, formData);
      toast.success('Contact details saved successfully');
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
      await contactsApi.syncAxcelerateForContact(contactIdNum);
      toast.success('Details successfully re-synced from Axcelerate');
      loadContact();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sync with Axcelerate');
    } finally {
      setSyncing(false);
    }
  };

  const loadAddressOptions = async (inputValue: string) => {
    if (inputValue.length < 3) return [];
    try {
      const response = await api.get('/address/search', { params: { q: inputValue } });
      return response.data.map((address: any) => ({
        label: address.addressLabel,
        value: address,
      }));
    } catch (err) {
      console.error('Failed to parse address core', err);
      return [];
    }
  };

  const handleAddressSelect = (selectedOption: any) => {
    if (!selectedOption) return;
    const addr = selectedOption.value;

    const unitLabel = [addr.buildingName, addr.flatType, addr.flatNumber].filter(Boolean).join(' ');

    let streetNo = addr.numberFirst || '';
    if (addr.numberLast) {
      streetNo = `${addr.numberFirst}-${addr.numberLast}`;
    }

    const streetLabel = [addr.streetName, addr.streetType, addr.streetSuffix].filter(Boolean).join(' ');

    setTempAddress({
      unitNo: unitLabel,
      address1: streetNo ? `${streetNo} ${streetLabel}` : streetLabel,
      city: addr.localityName,
      state: addr.state,
      postcode: addr.postcode,
      country: 'Australia',
      fullAddress: addr.addressLabel,
    });
  };

  const commitAddressChange = () => {
    setFormData((prev: any) => ({
      ...prev,
      unitNo: tempAddress.unitNo || '',
      address1: tempAddress.address1 || '',
      city: tempAddress.city || '',
      state: tempAddress.state || '',
      postcode: tempAddress.postcode || '',
      country: tempAddress.country || 'Australia',
      fullAddress: tempAddress.fullAddress || '',

      sUnitNo: tempAddress.unitNo || '',
      sAddress1: tempAddress.address1 || '',
      sCity: tempAddress.city || '',
      sState: tempAddress.state || '',
      sPostcode: tempAddress.postcode || '',
      sCountry: tempAddress.country || 'Australia',
      sFullAddress: tempAddress.fullAddress || '',
    }));
    setShowSearchModal(false);
    setShowEditModal(false);
  };

  const handleManualTempChange = (field: string, val: string) => {
    setTempAddress((prev: any) => ({
      ...prev,
      [field]: val,
    }));
  };

  useEffect(() => {
    if (showEditModal) {
      const parts = [
        tempAddress.unitNo,
        tempAddress.address1,
        tempAddress.city,
        tempAddress.state,
        tempAddress.postcode,
      ].filter((p) => !!p && p.trim().length > 0);
      setTempAddress((prev: any) => ({ ...prev, fullAddress: parts.join(', ') }));
    }
  }, [tempAddress.unitNo, tempAddress.address1, tempAddress.city, tempAddress.state, tempAddress.postcode, showEditModal]);

  const openSearchModal = () => {
    setTempAddress({});
    setShowSearchModal(true);
  };

  const openEditModal = () => {
    setTempAddress({
      unitNo: formData.unitNo,
      address1: formData.address1,
      city: formData.city,
      state: formData.state,
      postcode: formData.postcode,
      country: formData.country || 'Australia',
      fullAddress: formData.fullAddress,
    });
    setShowEditModal(true);
  };

  // Linked User handlers
  const handleUnlinkUser = async () => {
    setUserActionLoading(true);
    try {
      await contactsApi.unlinkUser(contactIdNum);
      toast.success('User account unlinked');
      loadContact();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to unlink user account');
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.emailAddress) {
      toast.error('Contact must have an email address to create a user account');
      return;
    }
    setUserActionLoading(true);
    try {
      await contactsApi.createUser(contactIdNum, customPassword || undefined);
      toast.success('User account created and linked');
      setCustomPassword('');
      loadContact();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create user account');
    } finally {
      setUserActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading contact details...</div>;
  }

  const fullName = [formData.givenName, formData.surname].filter(Boolean).join(' ') || 'Contact Details';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <button type="button" onClick={() => navigate('/contacts')} style={secondaryButtonStyle}>
              &larr; Back to Contacts
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>{fullName}</h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 12,
                background: formData.contactActive !== false ? '#dcfce7' : '#fee2e2',
                color: formData.contactActive !== false ? '#166534' : '#991b1b',
                border: formData.contactActive !== false ? '1px solid #bbf7d0' : '1px solid #fecaca',
              }}
            >
              {formData.contactActive !== false ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p style={{ color: '#64748b', marginTop: 4, marginBottom: 0 }}>
            View and update student contact profile (Contact ID: #{formData.contactId ?? 'N/A'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={async () => {
              const newStatus = formData.contactActive === false;
              try {
                await contactsApi.updateById(contactIdNum, { contactActive: newStatus });
                toast.success(`Contact marked as ${newStatus ? 'Active' : 'Inactive'}`);
                loadContact();
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Failed to update contact status');
              }
            }}
            style={{
              ...secondaryButtonStyle,
              color: formData.contactActive !== false ? '#dc2626' : '#16a34a',
              borderColor: formData.contactActive !== false ? '#fca5a5' : '#86efac',
            }}
          >
            {formData.contactActive !== false ? 'Deactivate Contact' : 'Reactivate Contact'}
          </button>
          <button type="button" onClick={handleSyncAxcelerate} style={secondaryButtonStyle} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync from Axcelerate'}
          </button>
          <button type="button" onClick={() => handleSave()} style={primaryButtonStyle} disabled={saving}>
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 24, overflowX: 'auto' }}>
        <TabButton label="Personal Details & Contact" active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} />
        <TabButton label="AVETMISS" active={activeTab === 'avetmiss'} onClick={() => setActiveTab('avetmiss')} />
        <TabButton label="Support & Declarations" active={activeTab === 'declarations'} onClick={() => setActiveTab('declarations')} />
        <TabButton label="Linked User Account" active={activeTab === 'linked-user'} onClick={() => setActiveTab('linked-user')} />
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
                    <option value="N">Non-binary (N)</option>
                    <option value="P">Prefer not to say (P)</option>
                    <option value="D">Different Term (D)</option>
                  </select>
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Unique Student Identifier (USI)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 280px' }}>
                    <label style={labelStyle}>USI Number</label>
                    <input
                      style={{
                        ...inputStyle,
                        background: formData.usiVerified ? '#e6f4ea' : '#ffffff',
                        borderColor: formData.usiVerified ? '#86efac' : '#cbd5e1',
                        fontWeight: formData.usiVerified ? 600 : 400,
                        letterSpacing: '0.05em',
                      }}
                      value={formData.usi || ''}
                      onChange={(e) => handleChange('usi', e.target.value.toUpperCase())}
                      placeholder="10-character code e.g. X22CDX2MGT"
                      readOnly={!!formData.usiVerified}
                      maxLength={10}
                    />
                  </div>

                  <div>
                    {formData.usiVerified ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleChange('usiVerified', false);
                          setUsiFeedback(null);
                        }}
                        style={{ ...secondaryButtonStyle, height: 42, padding: '0 16px', fontSize: 13 }}
                      >
                        Change / Re-verify USI
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleVerifyUsi}
                        disabled={verifyingUsi || !USI_REGEX.test((formData.usi || '').trim())}
                        style={{
                          ...(USI_REGEX.test((formData.usi || '').trim()) && !verifyingUsi ? primaryButtonStyle : secondaryButtonStyle),
                          height: 42,
                          padding: '0 20px',
                          fontSize: 13,
                          opacity: (USI_REGEX.test((formData.usi || '').trim()) && !verifyingUsi) ? 1 : 0.6,
                          cursor: (USI_REGEX.test((formData.usi || '').trim()) && !verifyingUsi) ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {verifyingUsi ? 'Verifying...' : 'Verify USI'}
                      </button>
                    )}
                  </div>

                  {formData.usiVerified && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 42, color: '#166534', fontWeight: 600, fontSize: 13, background: '#dcfce7', padding: '0 12px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: 16 }}>✓</span> USI Verified
                    </div>
                  )}
                </div>

                {usiFeedback && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      background: usiFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: usiFeedback.type === 'success' ? '#166534' : '#991b1b',
                      border: usiFeedback.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                    }}
                  >
                    {usiFeedback.message}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Do you give permission for Life Saving First Aid to access your USI transcript?</label>
                  <select
                    style={{ ...inputStyle, maxWidth: '500px' }}
                    value={formData.customFieldUsiPermission || ''}
                    onChange={(e) => handleChange('customFieldUsiPermission', e.target.value)}
                  >
                    <option value="">Select permission...</option>
                    <option value="Yes - I give permission for Life Saving First Aid to Access My USI Transcript">Yes - I give permission for Life Saving First Aid to Access My USI Transcript</option>
                    <option value="No - I do not give permission for Life Saving First Aid to access my USI Transcript">No - I do not give permission for Life Saving First Aid to access my USI Transcript</option>
                  </select>
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
                  <input style={inputStyle} value={formData.phone || formData.workPhone || ''} onChange={(e) => handleChange('phone', e.target.value)} />
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Residential Address</h3>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Current Value</label>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 500, color: '#0f172a' }}>
                    {formData.fullAddress || 'No address provided.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={openSearchModal} style={{ ...secondaryButtonStyle, padding: '4px 12px', fontSize: 13 }}>
                    Search Address
                  </button>
                  <button type="button" onClick={openEditModal} style={{ ...secondaryButtonStyle, padding: '4px 12px', fontSize: 13 }}>
                    Edit Manually
                  </button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Background & Language */}
              <h3 style={sectionTitleStyle}>Background & Language</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Indigenous Status</label>
                  <select
                    style={inputStyle}
                    value={String(formData.indigenousStatusId) || ''}
                    onChange={(e) => handleChange('indigenousStatusId', e.target.value ? e.target.value : null)}
                  >
                    <option value="">Select...</option>
                    {indigenousStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Country of Birth</label>
                  <select
                    style={inputStyle}
                    value={String(formData.countryOfBirthId ?? '1101')}
                    onChange={(e) => handleSelectChange('countryOfBirthId', 'countryOfBirthName', saccOptions, e.target.value)}
                  >
                    <option value="">Select Country...</option>
                    {saccOptions.map((opt) => (
                      <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Main Language Spoken at Home</label>
                  <select
                    style={inputStyle}
                    value={String(formData.mainLanguageId ?? '1201')}
                    onChange={(e) => handleSelectChange('mainLanguageId', 'mainLanguageName', asclOptions, e.target.value)}
                  >
                    <option value="">Select Language...</option>
                    {asclOptions.map((opt) => (
                      <option key={`${opt.value}-${opt.label}`} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>English Proficiency</label>
                  <select
                    style={inputStyle}
                    value={String(formData.englishProficiencyId) || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange('englishProficiencyId', val ? val : null);
                      if (val === '1') {
                        handleChange('englishAssistanceFlag', false);
                      }
                    }}
                  >
                    <option value="">Select...</option>
                    {englishProficiencyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {String(formData.englishProficiencyId) !== '1' && String(formData.englishProficiencyId) !== '' && formData.englishProficiencyId != null && (
                  <div>
                    <label style={labelStyle}>Requires English Assistance?</label>
                    <select
                      style={inputStyle}
                      value={formData.englishAssistanceFlag === true ? 'true' : 'false'}
                      onChange={(e) => handleChange('englishAssistanceFlag', e.target.value === 'true')}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Education & Vocational */}
              <h3 style={sectionTitleStyle}>Education & Vocational</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Are you currently at school?</label>
                  <select
                    style={inputStyle}
                    value={formData.atSchoolFlag === true ? 'true' : 'false'}
                    onChange={(e) => handleChange('atSchoolFlag', e.target.value === 'true')}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Highest School Level Attained</label>
                  <select
                    style={inputStyle}
                    value={String(formData.highestSchoolLevelId) || ''}
                    onChange={(e) => handleChange('highestSchoolLevelId', e.target.value ? e.target.value : null)}
                  >
                    <option value="">Select...</option>
                    {highestSchoolLevelCompletedOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Do you have prior completed post-school education?</label>
                  <select
                    style={inputStyle}
                    value={formData.priorEducationStatus === true ? 'true' : formData.priorEducationStatus === false ? 'false' : ''}
                    onChange={(e) => {
                      const val = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
                      setFormData((prev: any) => ({
                        ...prev,
                        priorEducationStatus: val,
                        priorEducationIds: val === true ? (prev.priorEducationIds || []) : [],
                      }));
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                {formData.priorEducationStatus === true && (
                  <div>
                    <label style={labelStyle}>Prior Education Qualifications</label>
                    <div style={checkboxListStyle}>
                      {priorEducationOptions.map((opt) => (
                        <label key={opt.value} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={isArrayFieldSelected('priorEducationIds', opt.value)}
                            onChange={(e) => toggleArrayField('priorEducationIds', opt.value, e.target.checked)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Study Reason</label>
                  <select
                    style={inputStyle}
                    value={String(formData.studyReasonId) || ''}
                    onChange={(e) => handleChange('studyReasonId', e.target.value ? e.target.value : null)}
                  >
                    <option value="">Select...</option>
                    {studyReasonOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Previous First Aid Related Study</label>
                  <div style={checkboxListStyle}>
                    {courseCodeOptions.map((courseOpt) => (
                      <label key={courseOpt} style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={isArrayFieldSelected('customFieldPreviousCerts', courseOpt)}
                          onChange={(e) => toggleArrayField('customFieldPreviousCerts', courseOpt, e.target.checked)}
                        />
                        {courseOpt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Employment */}
              <h3 style={sectionTitleStyle}>Employment</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Employment Status (Labour Force)</label>
                  <select
                    style={inputStyle}
                    value={formData.labourForceId != null ? String(formData.labourForceId).padStart(2, '0') : ''}
                    onChange={(e) => handleChange('labourForceId', e.target.value ? e.target.value : null)}
                  >
                    <option value="">Select...</option>
                    {labourForceStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {formData.labourForceId != null && ['01', '02', '03', '04', '05'].includes(String(formData.labourForceId).padStart(2, '0')) && (
                  <div>
                    <label style={labelStyle}>Job Title / Occupation</label>
                    <div style={checkboxListStyle}>
                      {cJobTitleOptions.map((title) => (
                        <label key={title} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={isArrayFieldSelected('customFieldPreviousJobTitles', title)}
                            onChange={(e) => toggleArrayField('customFieldPreviousJobTitles', title, e.target.checked)}
                          />
                          {title}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {formData.labourForceId != null && ['01', '02', '03', '04', '05'].includes(String(formData.labourForceId).padStart(2, '0')) && isArrayFieldSelected('customFieldPreviousJobTitles', 'Other') && (
                  <div>
                    <label style={labelStyle}>Other Job Title Details</label>
                    <input
                      style={inputStyle}
                      value={formData.customFieldPreviousJobTitlesOther || ''}
                      onChange={(e) => handleChange('customFieldPreviousJobTitlesOther', e.target.value)}
                      placeholder="Specify job title..."
                    />
                  </div>
                )}
              </div>

              {/* Disabilities */}
              <h3 style={sectionTitleStyle}>Disabilities</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Do you have a disability?</label>
                  <select
                    style={inputStyle}
                    value={formData.disabilityFlag === true ? 'true' : formData.disabilityFlag === false ? 'false' : ''}
                    onChange={(e) => {
                      const val = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
                      setFormData((prev: any) => ({
                        ...prev,
                        disabilityFlag: val,
                        disabilityTypeIds: val === true ? (prev.disabilityTypeIds || []) : [],
                      }));
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                {formData.disabilityFlag === true && (
                  <div>
                    <label style={labelStyle}>Disability Types</label>
                    <div style={checkboxListStyle}>
                      {disabilityOptions.map((opt) => (
                        <label key={opt.value} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            checked={isArrayFieldSelected('disabilityTypeIds', opt.value)}
                            onChange={(e) => toggleArrayField('disabilityTypeIds', opt.value, e.target.checked)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Wellbeing Requirements / Special Considerations</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '80px', fontFamily: 'inherit' }}
                    value={formData.customFieldWellbeingRequirements || ''}
                    onChange={(e) => handleChange('customFieldWellbeingRequirements', e.target.value)}
                    placeholder="Enter any wellbeing requirements, physical or learning adjustments..."
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'declarations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Support Section */}
              <h3 style={sectionTitleStyle}>Support Requirements</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Do you require additional support during training?</label>
                  <select
                    style={inputStyle}
                    value={formData.customFieldAdditionalSupport || 'No - I believe standard support will be sufficient'}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange('customFieldAdditionalSupport', val);
                      if (!val.startsWith('Yes')) {
                        handleChange('customFieldAdditionalSupportRequired', '');
                      }
                    }}
                  >
                    <option value="No - I believe standard support will be sufficient">No - I believe standard support will be sufficient</option>
                    <option value="Yes - I will require additional support to successfully complete this course">Yes - I will require additional support to successfully complete this course</option>
                  </select>
                </div>

                {formData.customFieldAdditionalSupport && formData.customFieldAdditionalSupport.startsWith('Yes') && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Details of Additional Support Required</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: '80px', fontFamily: 'inherit' }}
                      value={formData.customFieldAdditionalSupportRequired || ''}
                      onChange={(e) => handleChange('customFieldAdditionalSupportRequired', e.target.value)}
                      placeholder="Please specify any learning, language, physical or other support requirements..."
                    />
                  </div>
                )}
              </div>

              {/* Privacy Notice */}
              <h3 style={sectionTitleStyle}>Privacy Notice</h3>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#334155', lineHeight: '1.6' }}>
                As a registered training organisation (RTO), we are obligated to collect your personal information so we can process and manage your enrolment in a nationally accredited vocational education and training (VET) course. For more information please view our privacy page on our website{' '}
                <a
                  href="https://lifesavingfirstaid.com.au/private-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
                >
                  https://lifesavingfirstaid.com.au/private-policy/
                </a>
              </div>

              {/* Declarations */}
              <h3 style={sectionTitleStyle}>Declarations</h3>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: '1.6' }}>
                <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <li>I have read and been provided with the General Privacy Notice and therefore authorise Life Saving First Aid to release information regarding my enrolment to any government department and to other parties when it is legally obliged to do so.</li>
                  <li>I confirm that prior to enrolling in this course, I have read Life Saving First Aid’s Student Handbook and Course Outline to understand all information necessary to make an informed decision on enrolment for this course and how key Life Saving First Aid policies and procedures can relate to my circumstances.</li>
                  <li>I accept liability for the fees related to my enrolment and agree to comply with key Life Saving First Aid polices outlined in the Student Handbook including but not limited to the Student Code of Conduct.</li>
                  <li>I have disclosed any needs that may require additional support, including any wellbeing concerns or conditions that may be impacted by the nature of the training product content (e.g., scenarios involving injuries, emergencies, or sensitive topics), and understand that my enrolment may be refused if LSFA cannot reasonably provide or facilitate access to the required support services.</li>
                  <li>I have been provided with the opportunity for recognised prior learning and credit transfers and am aware of Life Saving First Aid’s schedule of fees as they relate to my enrolment. (N.B. Credit Transfer and Recognition of Prior Learning can be applied for at any time by emailing <a href="mailto:info@lifesavingfirstaid.com.au" style={{ color: '#2563eb', fontWeight: 600 }}>info@lifesavingfirstaid.com.au</a>)</li>
                  <li>I declare that the information I have provided to Life Saving First Aid in this form and in all previous correspondence is true and correct.</li>
                </ol>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                      checked={Boolean(formData.customFieldCombinedDeclaration) && formData.customFieldCombinedDeclaration.trim().length > 0 && formData.customFieldCombinedDeclaration !== 'false'}
                      onChange={(e) => {
                        handleChange(
                          'customFieldCombinedDeclaration',
                          e.target.checked ? 'I confirm, accept and agree to the above declarations' : ''
                        );
                      }}
                    />
                    I confirm, accept and agree to the above declarations
                  </label>
                </div>
              </div>

              {/* Marketing Permissions */}
              <h3 style={sectionTitleStyle}>Marketing Permissions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: '1.5' }}>
                  I give Life Saving First Aid permission to use my name, image, testimonial, or work for the purposes of marketing, advertising or promotion and understand I can withdraw this permission anytime by providing Life Saving First Aid with prior written instruction.
                </p>
                <div style={{ maxWidth: '600px' }}>
                  <select
                    style={inputStyle}
                    value={formData.customFieldMarketingPermission || ''}
                    onChange={(e) => handleChange('customFieldMarketingPermission', e.target.value)}
                  >
                    <option value="">Select permission...</option>
                    <option value="I give Life Saving First Aid permission to use my name, image, testimonial, or work for the purposes of marketing, advertising or promotion and understand I can withdraw this permission anytime by providing Life Saving First Aid with prior written instruction.">Yes - I give permission</option>
                    <option value="I do not wish to give Life Saving First Aid permission to use my image or work in any marketing or advertising materials">No - I do not wish to give permission</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'linked-user' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Linked System User Account</h3>
              <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
                This contact profile can be linked to an operational user account to allow system login.
              </p>

              {linkedUser ? (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 15 }}>{linkedUser.name}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{linkedUser.email}</div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#2563eb', color: '#fff' }}>
                          Role: {linkedUser.role}
                        </span>
                        <span style={{ fontSize: 12, marginLeft: 8, color: linkedUser.isActive ? '#16a34a' : '#dc2626' }}>
                          {linkedUser.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={handleUnlinkUser} style={{ ...secondaryButtonStyle, color: '#dc2626', borderColor: '#fca5a5' }} disabled={userActionLoading}>
                      {userActionLoading ? 'Working...' : 'Unlink User Account'}
                    </button>
                  </div>
                </div>
              ) : (() => {
                const contactEmail = (formData.emailAddress || '').trim().toLowerCase();
                const usersList = Array.isArray(allUsers) ? allUsers : [];
                const matchingUser = contactEmail ? usersList.find((u) => u.email && u.email.trim().toLowerCase() === contactEmail) : null;

                if (matchingUser) {
                  return (
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#0f172a' }}>Existing User Account Found</h4>
                      <p style={{ color: '#334155', fontSize: 14, margin: '0 0 16px 0' }}>
                        A system user account with email <strong>{matchingUser.email}</strong> already exists ({matchingUser.name} - {matchingUser.role}).
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          setUserActionLoading(true);
                          try {
                            await contactsApi.linkUser(contactIdNum, matchingUser.id);
                            toast.success(`Linked user ${matchingUser.email} to this contact`);
                            loadContact();
                          } catch (err: any) {
                            toast.error(err?.response?.data?.message || 'Failed to link user account');
                          } finally {
                            setUserActionLoading(false);
                          }
                        }}
                        style={primaryButtonStyle}
                        disabled={userActionLoading}
                      >
                        {userActionLoading ? 'Linking...' : `Link User ${matchingUser.email}`}
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#0f172a' }}>Create New User Account for Contact</h4>
                    {contactEmail ? (
                      <>
                        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                          No system user account exists for <strong>{contactEmail}</strong>. You can create one below.
                        </p>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            type="password"
                            placeholder="Optional custom temporary password..."
                            value={customPassword}
                            onChange={(e) => setCustomPassword(e.target.value)}
                          />
                          <button type="button" onClick={handleCreateUser} style={primaryButtonStyle} disabled={userActionLoading}>
                            {userActionLoading ? 'Creating...' : 'Create & Link User'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>
                        This contact does not have an email address set. Please add an email address on the Personal Details tab first.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </form>

      {/* G-NAF Search Modal */}
      {showSearchModal && (
        <div style={modalBackdropStyle} onClick={() => setShowSearchModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Search Australian Address (G-NAF)</h3>
            <p style={{ fontSize: 13, color: '#64748b' }}>Start typing your address to select an officially verified location.</p>
            <div style={{ margin: '16px 0' }}>
              <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={loadAddressOptions}
                onChange={handleAddressSelect}
                placeholder="Type street address, suburb or postcode..."
              />
            </div>
            {tempAddress.fullAddress && (
              <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <strong>Selected:</strong> {tempAddress.fullAddress}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowSearchModal(false)} style={secondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={commitAddressChange} style={primaryButtonStyle} disabled={!tempAddress.fullAddress}>Confirm Address</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Edit Modal */}
      {showEditModal && (
        <div style={modalBackdropStyle} onClick={() => setShowEditModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Address Manually</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0' }}>
              <div>
                <label style={labelStyle}>Unit / Flat Number</label>
                <input style={inputStyle} value={tempAddress.unitNo || ''} onChange={(e) => handleManualTempChange('unitNo', e.target.value)} placeholder="e.g. Unit 4" />
              </div>
              <div>
                <label style={labelStyle}>Street Address (Line 1)</label>
                <input style={inputStyle} value={tempAddress.address1 || ''} onChange={(e) => handleManualTempChange('address1', e.target.value)} placeholder="e.g. 123 Main St" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Suburb / City</label>
                  <input style={inputStyle} value={tempAddress.city || ''} onChange={(e) => handleManualTempChange('city', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={tempAddress.state || ''} onChange={(e) => handleManualTempChange('state', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Postcode</label>
                  <input style={inputStyle} value={tempAddress.postcode || ''} onChange={(e) => handleManualTempChange('postcode', e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowEditModal(false)} style={secondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={commitAddressChange} style={primaryButtonStyle}>Save Address</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components & Helpers
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: 'none',
        background: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
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
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  padding: '24px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748b',
  marginBottom: '6px',
};

const checkboxListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: '180px',
  overflowY: 'auto',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#334155',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#0f172a',
  margin: '8px 0 4px 0',
  borderBottom: '1px solid #f1f5f9',
  paddingBottom: '8px',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#ffffff',
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#334155',
  padding: '8px 16px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
};
