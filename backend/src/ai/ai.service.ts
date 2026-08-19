import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';

export interface RosterEntry {
  contact_id: number;
  name: string;
}

export interface ClassifyResult {
  student_name_read: string;
  matched_contact_id: number;
  matched_student_name: string;
  student_confidence: number;
  document_type: string;
  document_type_confidence: number;
  manual_review_required: boolean;
  notes: string;
  page_number?: number;
  used_model?: string;
  fallback_used?: boolean;
  fallback_from_model?: string;
}

const ALLOWED_DOC_TYPES = [
  'student_declaration',
  'incident_report',
  'additional_evidence',
  'unknown',
  'blank_page',
];

// Port of the WordPress plugin's AI scanned-paperwork classifier
// (DKTP_Shortcodes::ajax_ai_classify_paperwork_page). Identifies which student a
// scanned page belongs to and what paperwork type it is, via the OpenAI Responses API.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private settings: SettingsService) {}

  async classifyPage(
    instanceId: number,
    pageNumber: number,
    pageImage: string,
    roster: RosterEntry[],
  ): Promise<ClassifyResult> {
    if (!instanceId || !pageNumber) {
      throw new BadRequestException('Missing instanceId or pageNumber.');
    }
    if (!pageImage || !/^data:image\/(png|jpe?g|webp);base64,/i.test(pageImage)) {
      throw new BadRequestException('Missing or invalid page image.');
    }
    // Keep requests within a practical size for the model image input.
    if (pageImage.length > 9_000_000) {
      throw new BadRequestException(
        'Page image is too large. Please scan at a lower resolution or reduce PDF size.',
      );
    }

    const cleanRoster: RosterEntry[] = (roster ?? [])
      .filter((s) => s && Number(s.contact_id) > 0 && String(s.name ?? '').trim().length > 0)
      .map((s) => ({ contact_id: Number(s.contact_id), name: String(s.name).trim() }));

    if (cleanRoster.length === 0) {
      throw new BadRequestException('Student roster is empty. Load the student list first.');
    }

    const apiKey = (await this.settings.get('openai_api_key'))?.trim();
    if (!apiKey) {
      throw new BadRequestException('OpenAI API key is not configured. Set it in Settings → AI.');
    }

    const primaryModel = (await this.settings.get('ai_model_primary'))?.trim() || 'gpt-5.4-nano';
    const fallbackModel = (await this.settings.get('ai_model_fallback'))?.trim() || 'gpt-5.4-mini';

    const prompt = this.buildPrompt(cleanRoster);

    // Primary call — if this throws (network/HTTP), let it propagate so the client retries.
    const primaryRaw = await this.callOpenAi(apiKey, primaryModel, prompt, pageImage);
    let result = this.normalizeResult(primaryRaw, cleanRoster);
    let usedModel = primaryModel;
    let fallbackUsed = false;

    if (this.shouldFallbackToMini(result) && fallbackModel && fallbackModel !== primaryModel) {
      try {
        const fallbackRaw = await this.callOpenAi(apiKey, fallbackModel, prompt, pageImage);
        result = this.normalizeResult(fallbackRaw, cleanRoster);
        usedModel = fallbackModel;
        fallbackUsed = true;
      } catch (err: any) {
        result.notes = `${result.notes} Fallback model failed: ${err?.message}`.trim();
      }
    }

    return {
      ...result,
      page_number: pageNumber,
      used_model: usedModel,
      fallback_used: fallbackUsed,
      fallback_from_model: fallbackUsed ? primaryModel : '',
    };
  }

  private buildPrompt(cleanRoster: RosterEntry[]): string {
    const rosterJson = JSON.stringify(cleanRoster);
    return (
      'You are classifying one scanned page from an Australian RTO course paperwork pack.\n\n' +
      'Your job is ONLY to identify which student this page belongs to and what paperwork type it is. Do not assess compliance or suitability yet.\n\n' +
      'Available students for this workshop. You must only use one of these contact_id values when matching a student:\n' +
      rosterJson +
      '\n\n' +
      'Allowed document_type values:\n' +
      '- student_declaration: student declaration / learner declaration / student declaration page\n' +
      '- incident_report: incident report form / accident report / first aid incident scenario form\n' +
      '- additional_evidence: any other student paperwork/evidence that should be uploaded to the generic additional evidence field\n' +
      '- unknown: use this if the document type is not clear\n' +
      '- blank_page: use this for a blank or separator page\n\n' +
      'Return strict JSON only, no markdown, using exactly this structure:\n' +
      '{\n' +
      '  "student_name_read": "",\n' +
      '  "matched_contact_id": 0,\n' +
      '  "matched_student_name": "",\n' +
      '  "student_confidence": 0.0,\n' +
      '  "document_type": "unknown",\n' +
      '  "document_type_confidence": 0.0,\n' +
      '  "manual_review_required": true,\n' +
      '  "notes": ""\n' +
      '}\n\n' +
      'Rules:\n' +
      '- Match to a roster contact_id only when the name is visually plausible.\n' +
      '- If the name is missing or unclear, use matched_contact_id 0 and manual_review_required true.\n' +
      '- If the paperwork type is unclear, use document_type unknown and manual_review_required true.\n' +
      '- Confidence values must be numbers from 0.0 to 1.0.\n' +
      '- Be conservative. If unsure, flag manual_review_required true.\n'
    );
  }

  // Call OpenAI API for one paperwork page. Throws on failure.
  private async callOpenAi(
    apiKey: string,
    model: string,
    prompt: string,
    pageImage: string,
  ): Promise<any> {
    // 1. Try standard OpenAI Chat Completions API
    const chatPayload = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: pageImage,
                detail: 'auto',
              },
            },
          ],
        },
      ],
      max_completion_tokens: 700,
      response_format: { type: 'json_object' },
    };

    let response;
    try {
      response = await axios.post('https://api.openai.com/v1/chat/completions', chatPayload, {
        timeout: 90000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      });
    } catch (err: any) {
      throw new Error(`OpenAI request failed: ${err?.message}`);
    }

    // If 404 on /v1/chat/completions, attempt legacy/custom /v1/responses endpoint
    if (response.status === 404) {
      const responsesPayload = {
        model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: pageImage, detail: 'auto' },
            ],
          },
        ],
        max_output_tokens: 700,
      };

      try {
        response = await axios.post('https://api.openai.com/v1/responses', responsesPayload, {
          timeout: 90000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        });
      } catch (err: any) {
        throw new Error(`OpenAI request failed: ${err?.message}`);
      }
    }

    if (response.status < 200 || response.status >= 300) {
      const apiMsg = response.data?.error?.message || response.data?.message;
      throw new Error(`OpenAI returned HTTP ${response.status}${apiMsg ? `: ${apiMsg}` : ''}`);
    }

    const text = this.extractResponseText(response.data);
    return this.parseJsonObjectFromText(text);
  }

  // Extract text from an OpenAI API response (Chat Completions or Responses API).
  private extractResponseText(decoded: any): string {
    if (!decoded || typeof decoded !== 'object') return '';
    if (typeof decoded.output_text === 'string') return decoded.output_text;

    // Standard Chat Completions response
    if (Array.isArray(decoded.choices) && decoded.choices[0]?.message?.content) {
      const content = decoded.choices[0].message.content;
      if (typeof content === 'string') return content;
    }

    // Legacy/custom Responses API format
    const parts: string[] = [];
    if (Array.isArray(decoded.output)) {
      for (const item of decoded.output) {
        if (!item || !Array.isArray(item.content)) continue;
        for (const content of item.content) {
          if (content && typeof content.text === 'string') parts.push(content.text);
        }
      }
    }
    return parts.join('\n').trim();
  }

  // Parse the first JSON object from model text.
  private parseJsonObjectFromText(rawText: string): any {
    let text = (rawText ?? '').trim();
    if (text === '') {
      throw new Error('OpenAI returned an empty response.');
    }
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    try {
      const decoded = JSON.parse(text);
      if (decoded && typeof decoded === 'object') return decoded;
    } catch {
      /* fall through to bracket extraction */
    }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const decoded = JSON.parse(text.slice(start, end + 1));
        if (decoded && typeof decoded === 'object') return decoded;
      } catch {
        /* ignore */
      }
    }

    throw new Error('Could not parse OpenAI response as JSON.');
  }

  // Normalize and validate an AI paperwork classification result.
  private normalizeResult(result: any, cleanRoster: RosterEntry[]): ClassifyResult {
    const raw = result && typeof result === 'object' ? result : {};

    let documentType = String(raw.document_type ?? 'unknown').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!ALLOWED_DOC_TYPES.includes(documentType)) documentType = 'unknown';

    const studentNameRead = String(raw.student_name_read ?? '').trim();
    let contactId = Math.trunc(Number(raw.matched_contact_id ?? 0)) || 0;
    let studentConf = this.clamp01(Number(raw.student_confidence ?? 0));
    const docConf = this.clamp01(Number(raw.document_type_confidence ?? 0));
    let matchedName = '';

    for (const student of cleanRoster) {
      if (student.contact_id === contactId) {
        matchedName = student.name;
        break;
      }
    }

    if (!matchedName) {
      const candidate = String(raw.matched_student_name ?? '').trim() || studentNameRead;
      const resolved = this.resolveStudentFromName(candidate, cleanRoster);
      if (resolved.contact_id) {
        contactId = resolved.contact_id;
        matchedName = resolved.name;
        studentConf = Math.max(studentConf, resolved.score / 100);
      }
    }

    let manualReview = !!raw.manual_review_required;
    if (
      !contactId ||
      documentType === 'unknown' ||
      documentType === 'blank_page' ||
      studentConf < 0.9 ||
      docConf < 0.85
    ) {
      manualReview = true;
    }

    return {
      student_name_read: studentNameRead,
      matched_contact_id: contactId,
      matched_student_name: matchedName,
      student_confidence: studentConf,
      document_type: documentType,
      document_type_confidence: docConf,
      manual_review_required: manualReview,
      notes: String(raw.notes ?? '').trim(),
    };
  }

  private shouldFallbackToMini(result: ClassifyResult): boolean {
    if (!result) return true;
    if (result.document_type === 'blank_page') return false;
    return !!result.manual_review_required;
  }

  // ── Name matching (roster resolution) ─────────────────────────────────────

  private resolveStudentFromName(
    candidate: string,
    cleanRoster: RosterEntry[],
  ): { contact_id: number; name: string; score: number } {
    const candidateNorm = this.normalizeName(candidate);
    let best = { contact_id: 0, name: '', score: 0 };
    if (candidateNorm === '') return best;

    for (const student of cleanRoster) {
      const name = String(student.name ?? '');
      const score = this.nameMatchScore(candidateNorm, this.normalizeName(name));
      if (score > best.score) {
        best = { contact_id: Number(student.contact_id) || 0, name, score };
      }
    }

    if (best.score < 72) return { contact_id: 0, name: '', score: best.score };
    return best;
  }

  private normalizeName(name: string): string {
    return String(name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private nameMatchScore(candidateNorm: string, rosterNorm: string): number {
    if (candidateNorm === '' || rosterNorm === '') return 0;
    if (candidateNorm === rosterNorm) return 100;

    let score = this.similarPercent(candidateNorm, rosterNorm);

    if (candidateNorm.includes(rosterNorm) || rosterNorm.includes(candidateNorm)) {
      score = Math.max(score, 82);
    }

    const candidateParts = candidateNorm.split(' ').filter(Boolean);
    const rosterParts = rosterNorm.split(' ').filter(Boolean);
    const hits = candidateParts.filter((t) => rosterParts.includes(t)).length;
    if (candidateParts.length) {
      score = Math.max(score, Math.min(100, (hits / Math.max(1, candidateParts.length)) * 100));
    }

    if (
      candidateParts.length &&
      rosterParts.length &&
      candidateParts[candidateParts.length - 1] === rosterParts[rosterParts.length - 1]
    ) {
      score += 8;
    }
    if (
      candidateParts.length &&
      rosterParts.length &&
      candidateParts[0].charAt(0) === rosterParts[0].charAt(0)
    ) {
      score += 3;
    }

    return Math.min(100, score);
  }

  // Approximation of PHP similar_text() percentage (0-100) via longest common
  // substring recursion, matching PHP's algorithm.
  private similarPercent(a: string, b: string): number {
    const common = this.similarTextLength(a, b);
    const total = a.length + b.length;
    return total === 0 ? 0 : (common * 2.0 * 100) / total;
  }

  private similarTextLength(a: string, b: string): number {
    if (a.length === 0 || b.length === 0) return 0;

    let max = 0;
    let posA = 0;
    let posB = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        let k = 0;
        while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
        if (k > max) {
          max = k;
          posA = i;
          posB = j;
        }
      }
    }
    if (max === 0) return 0;

    return (
      max +
      this.similarTextLength(a.slice(0, posA), b.slice(0, posB)) +
      this.similarTextLength(a.slice(posA + max), b.slice(posB + max))
    );
  }

  // Automatically generate a 3-7 word professional summary of a KE statement
  async summarizeKe(statement: string): Promise<string> {
    if (!statement || !statement.trim()) {
      throw new BadRequestException('Statement is required for summary generation.');
    }

    const apiKey = (await this.settings.get('openai_api_key'))?.trim();
    if (!apiKey) {
      throw new BadRequestException('OpenAI API key is not configured. Set it in Settings → AI.');
    }

    const primaryModel = (await this.settings.get('ai_model_primary'))?.trim() || 'gpt-4o-mini';

    const prompt = 
      'You are a professional educational parser specializing in VET / ASQA training standards.\n' +
      'Given a technical Knowledge Evidence (KE) statement / requirement, generate a short, professional, 3 to 7 word summary that acts as a title for this item.\n' +
      'Rules:\n' +
      '- Maintain high technical accuracy (keep codes or critical standard terms like "DRSABCD" or "CPR" if mentioned).\n' +
      '- Make it active and clear.\n' +
      '- Output ONLY the 3 to 7 word summary. Do not include quotes, markdown, punctuation, or any introductory text.\n\n' +
      `Statement: ${statement}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: primaryModel,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 30,
          temperature: 0.3,
        },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid response structure from OpenAI.');
      }

      return content.trim().replace(/^["']|["']$/g, ''); // strip any accidental outer quotes
    } catch (err: any) {
      this.logger.error(`OpenAI summary generation failed: ${err.message}`);
      // Simple fallback if AI fails: grab first 5 words of statement and append '...'
      const words = statement.trim().split(/\s+/);
      if (words.length <= 5) return statement.trim();
      return words.slice(0, 5).join(' ') + '...';
    }
  }

  // Automatically generate a 3-7 word professional title summary for questions, content blocks, etc.
  async summarizeTextTitle(text: string, itemType: string = 'item'): Promise<string> {
    const plainText = (text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plainText) {
      return '';
    }

    const apiKey = (await this.settings.get('openai_api_key'))?.trim();
    if (!apiKey) {
      const words = plainText.split(/\s+/);
      if (words.length <= 5) return plainText;
      return words.slice(0, 5).join(' ') + '...';
    }

    const primaryModel = (await this.settings.get('ai_model_primary'))?.trim() || 'gpt-4o-mini';

    const prompt = 
      'You are a professional educational parser specializing in VET / ASQA training standards.\n' +
      `Given the text content for a ${itemType}, generate a short, professional, 3 to 7 word summary that acts as a concise title.\n` +
      'Rules:\n' +
      '- Maintain high technical accuracy (keep codes or critical standard terms like "DRSABCD" or "CPR" if mentioned).\n' +
      '- Make it active and clear.\n' +
      '- Output ONLY the 3 to 7 word summary title. Do not include quotes, markdown, punctuation, or any introductory text.\n\n' +
      `Text: ${plainText.slice(0, 1500)}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: primaryModel,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 30,
          temperature: 0.3,
        },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid response structure from OpenAI.');
      }

      return content.trim().replace(/^["']|["']$/g, '');
    } catch (err: any) {
      this.logger.error(`OpenAI summary generation failed: ${err.message}`);
      const words = plainText.split(/\s+/);
      if (words.length <= 5) return plainText;
      return words.slice(0, 5).join(' ') + '...';
    }
  }

  private clamp01(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}
