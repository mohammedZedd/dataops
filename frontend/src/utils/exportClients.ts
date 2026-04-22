import type { ClientUser } from '../types';

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function accessLabel(level?: string | null): string {
  if (!level) return '';
  if (level === 'full')       return 'Complet';
  if (level === 'restricted') return 'Restreint';
  if (level === 'read_only')  return 'Lecture seule';
  return level;
}

// XML-escape a value for inclusion in SpreadsheetML
function xmlEscape(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type CellType = 'String' | 'Number';
type Cell = { value: unknown; type?: CellType; style?: 'Header' };

function cellXml(c: Cell): string {
  const type = c.type ?? (typeof c.value === 'number' ? 'Number' : 'String');
  const styleAttr = c.style ? ` ss:StyleID="${c.style}"` : '';
  return `<Cell${styleAttr}><Data ss:Type="${type}">${xmlEscape(c.value)}</Data></Cell>`;
}

function rowXml(cells: Cell[]): string {
  return `<Row>${cells.map(cellXml).join('')}</Row>`;
}

function sheetXml(name: string, widths: number[], rows: Cell[][]): string {
  const cols = widths.map(w => `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join('');
  const body = rows.map(rowXml).join('');
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${cols}${body}</Table></Worksheet>`;
}

export function exportClientsToExcel(clients: ClientUser[]) {
  // ── Sheet 1: Clients ────────────────────────────────────────────────────────
  const headers: string[] = [
    'Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise',
    "Secteur d'activité", 'Forme juridique', 'Régime fiscal',
    'Comptable assigné', 'Documents', 'Statut', "Niveau d'accès",
    "Date d'inscription",
  ];
  const widths = [90, 110, 200, 100, 170, 150, 130, 120, 170, 70, 70, 100, 110];

  const headerRow: Cell[] = headers.map(h => ({ value: h, style: 'Header' }));
  const dataRows: Cell[][] = clients.map(c => [
    { value: c.first_name },
    { value: c.last_name },
    { value: c.email },
    { value: c.phone_number ?? '' },
    { value: c.client_company_name ?? '' },
    { value: c.secteur_activite ?? '' },
    { value: c.forme_juridique ?? '' },
    { value: c.regime_fiscal ?? '' },
    { value: (c.assigned_to ?? []).map(a => a.name).join(', ') },
    { value: c.documents_count ?? 0, type: 'Number' },
    { value: c.is_active ? 'Actif' : 'Inactif' },
    { value: accessLabel(c.access_level) },
    { value: fmtDate(c.created_at) },
  ]);

  const clientsSheet = sheetXml('Clients', widths, [headerRow, ...dataRows]);

  // ── Sheet 2: Statistiques ───────────────────────────────────────────────────
  const active = clients.filter(c => c.is_active).length;
  const statsRows: Cell[][] = [
    [{ value: 'Statistiques clients', style: 'Header' }, { value: '', style: 'Header' }],
    [{ value: 'Total clients' },    { value: clients.length, type: 'Number' }],
    [{ value: 'Clients actifs' },   { value: active, type: 'Number' }],
    [{ value: 'Clients inactifs' }, { value: clients.length - active, type: 'Number' }],
    [{ value: "Date d'export" },    { value: new Date().toLocaleString('fr-FR') }],
  ];
  const statsSheet = sheetXml('Statistiques', [160, 160], statsRows);

  // ── Workbook ────────────────────────────────────────────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E2A4A" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 ${clientsSheet}
 ${statsSheet}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const today = new Date().toISOString().split('T')[0];

  const a = document.createElement('a');
  a.href = url;
  a.download = `clients_comptaflow_${today}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
