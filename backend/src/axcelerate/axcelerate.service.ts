import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SettingsService } from '../settings/settings.service';

const BASE_URL = 'https://lifesavingfirstaid.app.axcelerate.com/api/';

@Injectable()
export class AxcelerateService {
  private readonly logger = new Logger(AxcelerateService.name);

  constructor(private settings: SettingsService) {}

  private async getClient(): Promise<AxiosInstance> {
    const wstoken = await this.settings.get('axcelerate_ws_token');
    const apitoken = await this.settings.get('axcelerate_api_token');

    if (!wstoken || !apitoken) {
      throw new Error('Axcelerate API credentials are not configured. Please set them in Settings.');
    }

    return axios.create({
      baseURL: BASE_URL,
      timeout: 60000,
      headers: {
        wstoken,
        apitoken,
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const client = await this.getClient();
    const res = await client.get<T>(endpoint, { params });
    return res.data;
  }

  async post<T = any>(endpoint: string, body: any = {}, params?: Record<string, any>): Promise<T> {
    const client = await this.getClient();
    const res = await client.post<T>(endpoint, body, { params });
    return res.data;
  }

  // ── Workshops ────────────────────────────────────────────────────────────────

  async getWorkshops(
    dateMin: string,
    dateMax: string,
    enrolmentOpen: boolean | null,
    isPublic: boolean | null,
  ): Promise<any[]> {
    const params: Record<string, any> = {
      startDate_min: dateMin,
      startDate_max: dateMax,
      finishDate_min: dateMin,
      finishDate_max: dateMax,
      displayLength: 5000,
      type: 'w',
    };
    if (enrolmentOpen !== null) params.enrolmentOpen = enrolmentOpen ? 1 : 0;
    if (isPublic !== null) params.public = isPublic ? 1 : 0;

    const result = await this.post('course/instance/search', {}, params);
    const data = result?.data ?? result;
    return Array.isArray(data) ? data : [];
  }

  // Port of PHP get_trainer_workshops — adds trainerContactID filter
  async getTrainerWorkshops(
    contactId: string,
    dateMin: string,
    dateMax: string,
    enrolmentOpen: boolean | null,
    isPublic: boolean | null,
  ): Promise<any[]> {
    const params: Record<string, any> = {
      trainerContactID: contactId,
      startDate_min: dateMin,
      startDate_max: dateMax,
      finishDate_min: dateMin,
      finishDate_max: dateMax,
      displayLength: 5000,
      type: 'w',
    };
    if (enrolmentOpen !== null) params.enrolmentOpen = enrolmentOpen ? 1 : 0;
    if (isPublic !== null) params.public = isPublic ? 1 : 0;

    const result = await this.post('course/instance/search', {}, params);
    const data = result?.data ?? result;
    return Array.isArray(data) ? data : [];
  }

  // Port of PHP get_instance_attendance
  async getInstanceAttendance(instanceId: number): Promise<any[]> {
    const result = await this.get('course/instance/attendance', {
      instanceid: instanceId,
      type: 'w',
    });
    return Array.isArray(result) ? result : [];
  }

  // Port of PHP mark_attendance (PUT)
  async markAttendance(
    instanceId: number,
    contactId: number,
    complexId: number,
    attended: 0 | 1,
    comment?: string,
  ): Promise<any> {
    const client = await this.getClient();
    const params: Record<string, any> = {
      instanceid: instanceId,
      type: 'w',
      contactID: contactId,
      complexID: complexId,
      attended,
    };
    if (comment) params.comment = comment;
    const url = `course/instance/attendance`;
    const res = await client.put(url, {}, { params });
    return res.data;
  }

  // Port of PHP get_instance_detail
  async getInstanceDetail(instanceId: number): Promise<any> {
    return this.get('course/instance/detail', { instanceID: instanceId, type: 'w' });
  }

  // Port of PHP get_instance_search_data
  async getInstanceSearchData(
    instanceId: number,
    enrolmentOpen: string,
    isPublic: string,
  ): Promise<any> {
    const params: Record<string, any> = {
      InstanceID: instanceId,
      enrolmentOpen,
      public: isPublic,
      displayLength: 5000,
      type: 'w',
    };
    const result = await this.post('course/instance/search', {}, params);
    const data = result?.data ?? result;
    if (Array.isArray(data) && data.length > 0) return data[0];
    return result;
  }

  // Port of PHP get_instance_olka_enrolments (simplified — returns raw for service to process)
  async getOlkaEnrolments(instanceId: number): Promise<any> {
    return this.get('course/enrolments', {
      instanceID: instanceId,
      type: 'p',
      displayLength: 5000,
    });
  }

  // PUT course/enrolment — set a single custom field on a student's workshop enrolment.
  async putEnrolmentCustomField(
    instanceId: number,
    contactId: number,
    fieldName: string,
    value: string,
  ): Promise<any> {
    const client = await this.getClient();
    const res = await client.put('course/enrolment', {}, {
      params: {
        contactID: contactId,
        type: 'w',
        instanceID: instanceId,
        [fieldName]: value,
      },
    });
    return res.data;
  }

  // PUT course/enrolment — used to sync checklist PDF URL to Axcelerate
  // Port of PHP: PUT course/enrolment?contactID=X&type=w&instanceID=X&customField_u_obschecklist=URL
  async putEnrolmentChecklistUrl(instanceId: number, contactId: number, checklistUrl: string): Promise<any> {
    return this.putEnrolmentCustomField(instanceId, contactId, 'customField_u_obschecklist', checklistUrl);
  }

  // ── Contacts (cached per request cycle by caller) ────────────────────────────

  async getContactDetail(contactId: number): Promise<any> {
    try {
      const result = await this.get(`contact/${contactId}`);
      return result;
    } catch (err: any) {
      this.logger.warn(`Failed to get contact detail for ${contactId}: ${err?.message}`);
      return null;
    }
  }

  async lookupContactByEmail(email: string): Promise<{ contactId: string; contactName: string }> {
    const result = await this.get<any[]>('contacts/search', { emailAddress: email });

    const first = Array.isArray(result) ? result[0] : null;
    const contactId = first?.CONTACTID ?? first?.contactID ?? first?.id;
    const contactName = first?.CONTACTNAME ?? first?.NAME ?? first?.name ?? '';

    if (!contactId) {
      throw new Error(`No Axcelerate contact found for email: ${email}`);
    }

    return {
      contactId: String(contactId),
      contactName: String(contactName),
    };
  }

  async getActiveWorkshopActivityMap(): Promise<Record<string, number>> {
    const result = await this.get<any[]>('courses', {
      type: 'w',
      public: false,
      displayLength: 100,
    });

    const map: Record<string, number> = {};
    for (const row of Array.isArray(result) ? result : []) {
      const isActive = row?.ISACTIVE === true || row?.ISACTIVE === 'true' || row?.ISACTIVE === 1;
      const code = String(row?.CODE ?? '').trim().toUpperCase();
      const id = parseInt(row?.ID ?? '0', 10);
      if (!isActive || !code || !id) continue;
      if (!map[code]) map[code] = id;
    }
    return map;
  }

  async createWorkshopFromSchedule(payload: {
    activity_id: number;
    name: string;
    date: string;
    location_id?: string | null;
    location_name?: string;
    start_time: string;
    end_time: string;
    max_participants?: number;
    course_code?: string;
    cost?: number;
    trainer_id?: string | null;
    trainer_name?: string | null;
    contact_id: number;
  }): Promise<any> {
    const params: Record<string, any> = {
      ID: payload.activity_id,
      type: 'w',
      name: payload.name,
      startDate: payload.date,
      finishDate: payload.date,
      startTime: payload.start_time,
      finishTime: payload.end_time,
      public: 1,
      syncDateDescriptor: 1,
      minParticipants: 1,
    };

    if (payload.cost !== undefined && payload.cost !== null && !isNaN(Number(payload.cost))) {
      params.cost = Number(payload.cost);
    }

    if (payload.contact_id && Number(payload.contact_id) > 0) {
      params.contactID = Number(payload.contact_id);
    }

    if (payload.trainer_id && Number(payload.trainer_id) > 0) {
      params.trainerContactID = Number(payload.trainer_id);
    }

    if (payload.location_id && payload.location_id !== 'all_locations' && Number(payload.location_id) > 0) {
      params.locationID = Number(payload.location_id);
    }

    if (payload.location_name) {
      params.location = payload.location_name;
    }

    if (payload.max_participants && Number(payload.max_participants) > 0) {
      params.maxParticipants = Number(payload.max_participants);
    }

    this.logger.log(`Creating Axcelerate workshop instance with query params: ${JSON.stringify(params)}`);

    return this.post('course/instance', {}, params);
  }

  // ── Locations ─────────────────────────────────────────────────────────────────

  async getLocations(): Promise<{ id: string; name: string }[]> {
    const result = await this.get<any[]>('course/deliveryLocations');
    if (!Array.isArray(result)) return [];

    return result
      .filter(
        (r) =>
          r.ACTIVE === true &&
          r.STREETNAME?.trim() &&
          r.NAME?.trim() &&
          parseInt(r.ID) > 0,
      )
      .map((r) => ({ id: String(r.ID), name: r.NAME.trim() }));
  }

  // ── Trainers (via saved report 94075) ─────────────────────────────────────────

  async getTrainers(): Promise<{ id: string; name: string }[]> {
    const result = await this.post('report/saved/run', {}, {
      reportID: 94075,
      displayLength: 100,
      offsetRows: 0,
    });

    const rows: any[] = result?.DATA ?? [];
    const map = new Map<string, string>();

    for (const row of rows) {
      const id = String(parseInt(row.CONTACTID ?? '0'));
      const name = (row.FULLNAME ?? '').trim();
      if (id !== '0' && name && !map.has(id)) map.set(id, name);
    }

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
