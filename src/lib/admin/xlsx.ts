// Minimal .xlsx reader — enough to read a spreadsheet's first sheet as rows of cells, in the
// browser, with no library: an .xlsx file is a zip of XML files. Uses the platform's own
// DecompressionStream, so nothing is uploaded anywhere and no dependency is added.

export interface XlsxCell {
  /** Text as shown for strings; the raw number for numeric cells */
  value: string | number | null;
  /** True when the cell's number format is a date format (value is an Excel day number) */
  date: boolean;
  /** Fill colour (RGB hex, e.g. "92D050") when the cell is highlighted */
  fill: string | null;
}
export interface XlsxSheet { name: string; rows: XlsxCell[][] }

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read every file in a zip archive (central directory → local headers). */
async function unzip(buf: ArrayBuffer): Promise<Map<string, string>> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This isn’t an Excel (.xlsx) file.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('The Excel file looks damaged.');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    files.set(name, dec.decode(method === 0 ? raw : await inflate(raw)));
  }
  return files;
}

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');

// Built-in Excel number formats that display dates (ids 14–22, 45–47)
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Column letters → zero-based index ("A" → 0, "AB" → 27). */
const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export async function readXlsx(buf: ArrayBuffer): Promise<XlsxSheet[]> {
  const files = await unzip(buf);
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  // Styles: which cell style is a date, and which is highlighted
  const stylesXml = files.get('xl/styles.xml') ?? '';
  const customDate = new Set([...stylesXml.matchAll(/<numFmt\b[^>]*>/g)]
    .filter((m) => /[dmy]/i.test((attr(m[0], 'formatCode') ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '')))
    .map((m) => Number(attr(m[0], 'numFmtId'))));
  const fills = [...(stylesXml.match(/<fills[\s\S]*?<\/fills>/)?.[0] ?? '').matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => {
    if (!/patternType="solid"/.test(m[1])) return null;
    const rgb = m[1].match(/<fgColor\b[^>]*rgb="(?:FF)?([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase() ?? null;
    return rgb === 'FFFFFF' ? null : rgb;
  });
  const xfs = [...(stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? '').matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const fmt = Number(attr(m[0], 'numFmtId') ?? 0);
    return { date: DATE_FORMAT_IDS.has(fmt) || customDate.has(fmt), fill: fills[Number(attr(m[0], 'fillId') ?? 0)] ?? null };
  });

  // Sheet names → files, via the workbook relationships
  const rels = new Map([...(files.get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => [attr(m[0], 'Id'), (attr(m[0], 'Target') ?? '').replace(/^\/?(xl\/)?/, 'xl/')]));
  const sheets = [...(files.get('xl/workbook.xml') ?? '').matchAll(/<sheet\b[^>]*>/g)].map((m) => ({ name: unescape(attr(m[0], 'name') ?? 'Sheet'), file: rels.get(attr(m[0], 'r:id')) ?? '' }));

  return sheets.map(({ name, file }) => {
    const xml = files.get(file) ?? '';
    const rows: XlsxCell[][] = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
      const r = Number(attr(rm[1] ?? rm[3] ?? '', 'r')) - 1;
      const cells: XlsxCell[] = [];
      for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const t = attr(cm[1], 't'); const s = Number(attr(cm[1], 's') ?? 0); const ref = attr(cm[1], 'r');
        const inner = cm[2] ?? '';
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value: XlsxCell['value'] = null;
        if (t === 's' && v != null) value = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') value = texts(inner);
        else if (t === 'str' || t === 'e') value = v != null ? unescape(v) : null;
        else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (v != null && v !== '') value = Number(v);
        const style = xfs[s] ?? { date: false, fill: null };
        cells[ref ? colIndex(ref) : cells.length] = { value, date: style.date && typeof value === 'number', fill: style.fill };
      }
      rows[r >= 0 ? r : rows.length] = Array.from(cells, (c) => c ?? { value: null, date: false, fill: null });
    }
    return { name, rows: Array.from(rows, (r) => r ?? []) };
  });
}

/** Excel day number (1900 system) → YYYY-MM-DD. */
export function excelDate(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return d.toISOString().slice(0, 10);
}
