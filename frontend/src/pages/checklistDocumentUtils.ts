import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';

// jspdf-autotable's export shape varies across CJS/ESM interop (default fn vs { default: fn }).
// Resolve to the callable so this works regardless of how the bundler loads it.
const autoTable: (doc: jsPDF, options: any) => void =
  typeof autoTableModule === 'function'
    ? (autoTableModule as unknown as (doc: jsPDF, options: any) => void)
    : ((autoTableModule as any).default as (doc: jsPDF, options: any) => void);

export function isDebugChecklistMode(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return false;
  const source = typeof search === 'string' ? search : search.toString();
  const params = new URLSearchParams(source.startsWith('?') ? source.slice(1) : source);
  return params.get('debug') === 'true';
}

export function buildChecklistDocumentHtml(
  student: { givenName?: string; surname?: string; preferredName?: string; contactId?: number },
  payload: any,
  courseCode: string,
  trainerName: string,
  workshopDate: string,
  instanceId?: number | string,
  venue?: string,
): string {
  const escape = (value: string | number | undefined | null) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const studentFirst = student.preferredName?.trim() || student.givenName?.trim() || '';
  const studentName = `${studentFirst} ${student.surname?.trim() ?? ''}`.trim();
  const contactId = student.contactId ?? '';
  const course = courseCode || '';
  const workshop = workshopDate || '';
  const trainer = trainerName || '';
  const venueName = venue || '';
  const overall = payload?.top_level ?? payload?.topLevel ?? payload?.course_overall ?? '?';

  let docHtml = '<div style="font-family:Arial, Helvetica, sans-serif; color:#111;">';
  docHtml += '<h2 style="margin-bottom:6px;">Practical Tasks Observation Checklist</h2>';
  docHtml += '<p><strong>Name:</strong> ' + escape(studentName) + ' &nbsp; <strong>Contact ID:</strong> ' + escape(contactId) + '</p>';
  docHtml += '<p><strong>Course Code:</strong> ' + escape(course) + ' &nbsp; <strong>Workshop Date:</strong> ' + escape(workshop) + ' &nbsp; <strong>Instance ID:</strong> ' + escape(instanceId) + '</p>';
  docHtml += '<p><strong>Trainer:</strong> ' + escape(trainer) + ' &nbsp; <strong>Venue:</strong> ' + escape(venueName) + '</p>';
  docHtml += '<p><strong>Overall Result:</strong> ' + escape(overall) + '</p>';
  docHtml += '<table style="width:100%; border-collapse:collapse; margin-top:12px;">';
  docHtml += '<thead><tr><th style="border:1px solid #ddd;padding:6px;text-align:left;">Task</th><th style="border:1px solid #ddd;padding:6px;text-align:left;">Element / Sub-element</th><th style="border:1px solid #ddd;padding:6px;text-align:center;">Result</th></tr></thead>';
  docHtml += '<tbody>';

  const sc = payload.student_checklist || {};
  Object.keys(sc).forEach(function(ptid) {
    const task = sc[ptid] || {};
    const taskName = task.task_name || task.name || ptid;
    const taskTrainerComment = task.trainer_comment || '';
    const elements = task.elements || {};
    const elementKeys = Object.keys(elements);

    if (elementKeys.length === 0) {
      docHtml += '<tr><td style="border:1px solid #ddd;padding:6px;vertical-align:top;">' + escape(taskName) + (taskTrainerComment ? '<div style="margin-top:6px;color:#333;font-size:0.95em;"><strong>Trainer comment:</strong> ' + escape(taskTrainerComment) + '</div>' : '') + '</td><td style="border:1px solid #ddd;padding:6px;">(No elements)</td><td style="border:1px solid #ddd;padding:6px;text-align:center;">-</td></tr>';
    } else {
      elementKeys.forEach(function(eid) {
        const el = elements[eid] || {};
        const elTitle = el.title || el.text || eid;
        const elStatus = el.overall_status || el.status || '';
        const subs = el.sub_elements || el.subElements || {};
        const subKeys = Object.keys(subs || {});

        if (subKeys.length > 0) {
          let first = true;
          subKeys.forEach(function(sid) {
            const s = subs[sid] || {};
            const sText = s.text || s || '';
            const sStatus = s.status || '';
            if (first) {
              docHtml += '<tr>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;vertical-align:top;">' + escape(taskName) + (taskTrainerComment ? '<div style="margin-top:6px;color:#333;font-size:0.95em;"><strong>Trainer comment:</strong> ' + escape(taskTrainerComment) + '</div>' : '') + '</td>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;"><strong>' + escape(elTitle) + '</strong><div style="margin-top:4px;">' + escape(sText) + '</div></td>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;text-align:center;">' + escape(elStatus || sStatus) + '</td>';
              docHtml += '</tr>';
              first = false;
            } else {
              docHtml += '<tr>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;"></td>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;">' + escape(sText) + '</td>';
              docHtml += '<td style="border:1px solid #ddd;padding:6px;text-align:center;">' + escape(sStatus) + '</td>';
              docHtml += '</tr>';
            }
          });
        } else {
          docHtml += '<tr>';
          docHtml += '<td style="border:1px solid #ddd;padding:6px;vertical-align:top;">' + escape(taskName) + '</td>';
          docHtml += '<td style="border:1px solid #ddd;padding:6px;">' + escape(elTitle) + '</td>';
          docHtml += '<td style="border:1px solid #ddd;padding:6px;text-align:center;">' + escape(elStatus) + '</td>';
          docHtml += '</tr>';
        }
      });
    }
  });

  docHtml += '</tbody></table>';
  docHtml += '</div>';
  return docHtml;
}

// Fast, client-side, text-based checklist PDF (jsPDF + autotable). No browser,
// no server round-trip, crisp selectable text, automatic page breaks.
export function buildChecklistPdfBlob(
  student: { givenName?: string; surname?: string; preferredName?: string; contactId?: number },
  payload: any,
  courseCode: string,
  trainerName: string,
  workshopDate: string,
  instanceId?: number | string,
  venue?: string,
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const studentFirst = student.preferredName?.trim() || student.givenName?.trim() || '';
  const studentName = `${studentFirst} ${student.surname?.trim() ?? ''}`.trim();
  const contactId = student.contactId ?? '';
  const course = payload?.course_code || courseCode || '';
  const overall = payload?.top_level ?? payload?.topLevel ?? payload?.course_overall ?? '?';

  let y = 14;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Practical Tasks Observation Checklist', 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${studentName}     Contact ID: ${contactId}`, 14, y);
  y += 5;
  doc.text(`Course Code: ${course}     Workshop Date: ${workshopDate || ''}     Instance ID: ${instanceId ?? ''}`, 14, y);
  y += 5;
  doc.text(`Trainer: ${trainerName || ''}     Venue: ${venue || ''}`, 14, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Overall Result: ${overall}`, 14, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  const bodyRows: Array<[string, string, string]> = [];
  const sc = payload?.student_checklist || {};
  Object.keys(sc).forEach((ptid) => {
    const task = sc[ptid] || {};
    const taskName = task.task_name || task.name || ptid;
    const comment = task.trainer_comment || '';
    const taskCell = comment ? `${taskName}\n\nTrainer comment: ${comment}` : taskName;
    const elements = task.elements || {};
    const eids = Object.keys(elements);

    if (eids.length === 0) {
      bodyRows.push([taskCell, '(No elements)', '-']);
      return;
    }

    let firstOfTask = true;
    eids.forEach((eid) => {
      const el = elements[eid] || {};
      const title = el.title || el.text || eid;
      const elStatus = el.overall_status || el.status || '';
      const subs = el.sub_elements || el.subElements || {};
      const sids = Object.keys(subs);

      if (sids.length > 0) {
        let firstSub = true;
        sids.forEach((sid) => {
          const s = subs[sid] || {};
          const sText = typeof s === 'string' ? s : (s.text || '');
          const sStatus = (typeof s === 'object' && s.status) || '';
          const taskColumn = firstOfTask && firstSub ? taskCell : '';
          const elementColumn = firstSub ? `${title}\n${sText}` : sText;
          const resultColumn = firstSub ? (elStatus || sStatus || '') : (sStatus || '');
          bodyRows.push([taskColumn, elementColumn, resultColumn]);
          firstSub = false;
          firstOfTask = false;
        });
      } else {
        const taskColumn = firstOfTask ? taskCell : '';
        bodyRows.push([taskColumn, title, elStatus || '']);
        firstOfTask = false;
      }
    });
  });

  autoTable(doc, {
    startY: y + 3,
    head: [['Task', 'Element / Sub-element', 'Result']],
    body: bodyRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [247, 247, 247], textColor: 20, halign: 'left' },
    columnStyles: { 0: { cellWidth: 48 }, 2: { cellWidth: 20, halign: 'center' } },
  });

  return doc.output('blob');
}
