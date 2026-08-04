import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AsyncSelect from 'react-select/async';
import { contactsApi, usersApi } from '../api';
import { saccOptions } from '../utils/sacc';
import { asclOptions } from '../utils/ascl';
import { useToast } from '../context/ToastContext';
import axios from 'axios';

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
  { value: "008", label: "008 - Bachelor Degree or Higher Degree level" },
  { value: "410", label: "410 - Advanced Diploma or Associate Degree Level" },
  { value: "420", label: "420 - Diploma Level" },
  { value: "511", label: "511 - Certificate IV" },
  { value: "514", label: "514 - Certificate III" },
  { value: "521", label: "521 - Certificate II" },
  { value: "524", label: "524 - Certificate I" },
  { value: "990", label: "990 - Miscellaneous Education" }
];

export const disabilityOptions = [
  { value: "11", label: "11 - Hearing/Deaf" },
  { value: "12", label: "12 - Physical" },
  { value: "13", label: "13 - Intellectual" },
  { value: "14", label: "14 - Learning" },
  { value: "15", label: "15 - Mental Illness" },
  { value: "16", label: "16 - Acquired Brain Impairment" },
  { value: "17", label: "17 - Vision" },
  { value: "18", label: "18 - Medical Condition" },
  { value: "19", label: "19 - Other" }
];

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

  // Linked User tab state
  const [linkedUser, setLinkedUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [customPassword, setCustomPassword] = useState<string>('');
  const [userActionLoading, setUserActionLoading] = useState(false);

  useEffect(() => {
    loadContact();
    loadUsers();
  }, [contactIdNum]);

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
      await contactsApi.syncAxcelerate();
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
      const response = await axios.get(`http://localhost:3000/api/address/search?q=${encodeURIComponent(inputValue)}`);
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
          </div>
          <p style={{ color: '#64748b', marginTop: 4, marginBottom: 0 }}>
            View and update student contact profile (Contact ID: #{formData.contactId ?? 'N/A'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
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
        <TabButton label="Declarations & Custom" active={activeTab === 'declarations'} onClick={() => setActiveTab('declarations')} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Background & Language</h3>
              <div style={gridStyle}>
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
                  <select style={inputStyle} value={String(formData.englishProficiencyId) || ''} onChange={(e) => handleChange('englishProficiencyId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {englishProficiencyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Requires English Assistance?</label>
                  <select style={inputStyle} value={formData.englishAssistanceFlag === true ? 'true' : formData.englishAssistanceFlag === false ? 'false' : ''} onChange={(e) => handleChange('englishAssistanceFlag', e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)}>
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Indigenous Status</label>
                  <select style={inputStyle} value={String(formData.indigenousStatusId) || ''} onChange={(e) => handleChange('indigenousStatusId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {indigenousStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h3 style={sectionTitleStyle}>Education & Vocational</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Highest School Level Attained</label>
                  <select style={inputStyle} value={String(formData.highestSchoolLevelId) || ''} onChange={(e) => handleChange('highestSchoolLevelId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {highestSchoolLevelCompletedOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Year Highest School Level Completed</label>
                  <input style={inputStyle} value={formData.highestSchoolLevelYear || ''} onChange={(e) => handleChange('highestSchoolLevelYear', e.target.value)} placeholder="e.g. 1994" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ maxWidth: '320px' }}>
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
                </div>

                {formData.priorEducationStatus === true && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Prior Education Qualifications (Hold down CTRL to select multiple)</label>
                    <select
                      style={{ ...inputStyle, height: '140px' }}
                      multiple
                      value={formData.priorEducationIds || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                        handleChange('priorEducationIds', selected);
                      }}
                    >
                      {priorEducationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Labour Force Status</label>
                  <select style={inputStyle} value={String(formData.labourForceId) || ''} onChange={(e) => handleChange('labourForceId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {labourForceStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Study Reason</label>
                  <select style={inputStyle} value={String(formData.studyReasonId) || ''} onChange={(e) => handleChange('studyReasonId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {studyReasonOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Job Title / Occupation</label>
                  <input style={inputStyle} value={formData.customFieldJobTitle || ''} onChange={(e) => handleChange('customFieldJobTitle', e.target.value)} placeholder="Project Manager, etc." />
                </div>
              </div>

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
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Disability Types (Hold down CTRL to select multiple)</label>
                    <select
                      style={{ ...inputStyle, height: '140px' }}
                      multiple
                      value={formData.disabilityTypeIds || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                        handleChange('disabilityTypeIds', selected);
                      }}
                    >
                      {disabilityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'declarations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={sectionTitleStyle}>Declarations & Custom Fields</h3>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Dietary Requirements</label>
                  <input style={inputStyle} value={formData.customFieldDietary || ''} onChange={(e) => handleChange('customFieldDietary', e.target.value)} placeholder="Vegetarian, Gluten Free, etc." />
                </div>
                <div>
                  <label style={labelStyle}>Special Needs / Notes</label>
                  <input style={inputStyle} value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} />
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
