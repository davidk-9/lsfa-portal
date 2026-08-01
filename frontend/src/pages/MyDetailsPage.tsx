import { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import { useToast } from '../context/ToastContext';
import { contactsApi } from '../api';
import { saccOptions } from '../utils/sacc';
import { asclOptions } from '../utils/ascl';
import axios from 'axios';

type Tab = 'personal' | 'avetmiss' | 'declarations';

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

export const mainLanguageSpokenOptions = [
  { value: "1201", label: "English" },
  { value: "@@@@", label: "Other - Not specified" }
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

export function MyDetailsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Address UI State Toggle
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempAddress, setTempAddress] = useState<any>({}); // Hold state locally while editing

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

  const handleSelectChange = (idField: string, nameField: string, options: { value: string, label: string }[], selectedValue: string) => {
    const foundOpt = options.find(o => o.value === selectedValue);
    setFormData((prev: any) => ({
      ...prev,
      [idField]: selectedValue ? (isNaN(Number(selectedValue)) ? selectedValue : Number(selectedValue)) : null,
      [nameField]: foundOpt ? foundOpt.label : ''
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation checks for Prior Education and Disability flags
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

  const loadAddressOptions = async (inputValue: string) => {
    if (inputValue.length < 3) return [];
    try {
      const response = await axios.get(`http://localhost:3000/api/address/search?q=${encodeURIComponent(inputValue)}`);
      return response.data.map((address: any) => ({
        label: address.addressLabel,
        value: address
      }));
    } catch (err) {
      console.error('Failed to parse address core', err);
      return [];
    }
  };

  const handleAddressSelect = (selectedOption: any) => {
    if (!selectedOption) return;
    const addr = selectedOption.value;
    
    // G-NAF explicitly uses NUMBER_FIRST (and optionally NUMBER_LAST) for street numbers
    // AND it explicitly maps BUILDING_NAME, FLAT_TYPE, FLAT_NUMBER for units.
    const unitLabel = [addr.buildingName, addr.flatType, addr.flatNumber].filter(Boolean).join(' ');
    
    let streetNo = addr.numberFirst || '';
    if (addr.numberLast) {
      streetNo = `${addr.numberFirst}-${addr.numberLast}`;
    }

    const streetLabel = [addr.streetName, addr.streetType, addr.streetSuffix].filter(Boolean).join(' ');

    setTempAddress({ 
      unitNo: unitLabel,
      address1: streetNo ? `${streetNo} ${streetLabel}` : streetLabel, // Standard Axcelerate combined line 1
      city: addr.localityName,
      state: addr.state,
      postcode: addr.postcode,
      country: 'Australia',
      fullAddress: addr.addressLabel // The explicit GNAF core label
    });
  };

  const commitAddressChange = () => {
    setFormData((prev: any) => ({
      ...prev,
      // Main Address
      unitNo: tempAddress.unitNo || '',
      address1: tempAddress.address1 || '',
      city: tempAddress.city || '',
      state: tempAddress.state || '',
      postcode: tempAddress.postcode || '',
      country: tempAddress.country || 'Australia',
      fullAddress: tempAddress.fullAddress || '',

      // Postal SAddress mirroring
      sUnitNo: tempAddress.unitNo || '',
      sAddress1: tempAddress.address1 || '',
      sCity: tempAddress.city || '',
      sState: tempAddress.state || '',
      sPostcode: tempAddress.postcode || '',
      sCountry: tempAddress.country || 'Australia',
      sFullAddress: tempAddress.fullAddress || ''
    }));
    setShowSearchModal(false);
    setShowEditModal(false);
  };

  const handleManualTempChange = (field: string, val: string) => {
    setTempAddress((prev: any) => ({
      ...prev,
      [field]: val
    }));
  };

  // Rebuild the address string if the user manually changes components
  useEffect(() => {
    if (showEditModal) {
      const parts = [
        tempAddress.unitNo, 
        tempAddress.address1, 
        tempAddress.city, 
        tempAddress.state, 
        tempAddress.postcode
      ].filter(p => !!p && p.trim().length > 0);
      setTempAddress((prev: any) => ({ ...prev, fullAddress: parts.join(', ') }));
    }
  }, [tempAddress.unitNo, tempAddress.address1, tempAddress.city, tempAddress.state, tempAddress.postcode, showEditModal]);

  const openSearchModal = () => {
    setTempAddress({}); // reset temp container
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
      fullAddress: formData.fullAddress
    });
    setShowEditModal(true);
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
        <TabButton label="AVETMISS" active={activeTab === 'avetmiss'} onClick={() => setActiveTab('avetmiss')} />
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

              <h3 style={sectionTitleStyle}>
                Residential Address
              </h3>
              
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Current Value</label>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 500, color: '#0f172a' }}>
                    {formData.fullAddress || "No address provided."}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={openSearchModal} style={{...secondaryButtonStyle, padding: '4px 12px', fontSize: 13}}>
                    Search Address
                  </button>
                  <button type="button" onClick={openEditModal} style={{...secondaryButtonStyle, padding: '4px 12px', fontSize: 13}}>
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
                    {saccOptions.map(opt => (
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
                    {asclOptions.map(opt => (
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
                    {englishProficiencyOptions.map(opt => (
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
                    {indigenousStatusOptions.map(opt => (
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
                    {highestSchoolLevelCompletedOptions.map(opt => (
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
                          // Clear selections if toggled to No (false) or empty
                          priorEducationIds: val === true ? (prev.priorEducationIds || []) : []
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
                      style={{...inputStyle, height: '140px'}} 
                      multiple 
                      value={formData.priorEducationIds || []} 
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        handleChange('priorEducationIds', selected);
                      }}
                    >
                      {priorEducationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Labour Force Status</label>
                  <select style={inputStyle} value={String(formData.labourForceId) || ''} onChange={(e) => handleChange('labourForceId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {labourForceStatusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>                    
                  <label style={labelStyle}>Study Reason</label>
                  <select style={inputStyle} value={String(formData.studyReasonId) || ''} onChange={(e) => handleChange('studyReasonId', e.target.value ? e.target.value : null)}>
                    <option value="">Select...</option>
                    {studyReasonOptions.map(opt => (
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
                        // Clear selections if toggled to No (false) or empty
                        disabilityTypeIds: val === true ? (prev.disabilityTypeIds || []) : []
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
                      style={{...inputStyle, height: '140px'}} 
                      multiple 
                      value={formData.disabilityTypeIds || []} 
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        handleChange('disabilityTypeIds', selected);
                      }}
                    >
                      {disabilityOptions.map(opt => (
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

      {/* Address Search Modal */}
      {showSearchModal && (
        <div style={modalBackdropStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Search Address</h2>
            <AsyncSelect
              cacheOptions
              defaultOptions={false}
              loadOptions={loadAddressOptions}
              onChange={handleAddressSelect}
              placeholder="Start typing your address (e.g., 200 Fake St)..."
              noOptionsMessage={({ inputValue }) => !inputValue ? "Type to search" : "No addresses found"}
            />
            {tempAddress.fullAddress && (
              <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 4 }}>
                <strong>Preview:</strong> {tempAddress.fullAddress}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" onClick={() => setShowSearchModal(false)} style={{...secondaryButtonStyle, padding: '8px 16px'}}>Cancel</button>
              <button type="button" onClick={commitAddressChange} style={{...primaryButtonStyle, padding: '8px 16px'}} disabled={!tempAddress.fullAddress}>Save Selection</button>
            </div>
          </div>
        </div>
      )}

      {/* Address Edit Modal */}
      {showEditModal && (
        <div style={modalBackdropStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Edit Address Manually</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Full Address Preview</label>
                <input style={{...inputStyle, background: '#f1f5f9'}} value={tempAddress.fullAddress || ''} readOnly />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Building Name / Unit No.</label>
                <input style={inputStyle} value={tempAddress.unitNo || ''} onChange={(e) => handleManualTempChange('unitNo', e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Street Number & Name</label>
                <input style={inputStyle} value={tempAddress.address1 || ''} onChange={(e) => handleManualTempChange('address1', e.target.value)} placeholder="24 Peridot Cres" />
              </div>
              <div>
                <label style={labelStyle}>Suburb / City</label>
                <input style={inputStyle} value={tempAddress.city || ''} onChange={(e) => handleManualTempChange('city', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input style={inputStyle} value={tempAddress.state || ''} onChange={(e) => handleManualTempChange('state', e.target.value)} placeholder="QLD" />
              </div>
              <div>
                <label style={labelStyle}>Postcode</label>
                <input style={inputStyle} value={tempAddress.postcode || ''} onChange={(e) => handleManualTempChange('postcode', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" onClick={() => setShowEditModal(false)} style={{...secondaryButtonStyle, padding: '8px 16px'}}>Cancel</button>
              <button type="button" onClick={commitAddressChange} style={{...primaryButtonStyle, padding: '8px 16px'}}>Save Address</button>
            </div>
          </div>
        </div>
      )}
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
