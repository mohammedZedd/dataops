import type { Client, Document, Invoice } from '../types';

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients: Client[] = [
  {
    id: '1',
    name: 'SARL Dupont Construction',
    siret: '12345678900014',
    email: 'contact@dupont-construction.fr',
    documentsCount: 5,
    invoicesToReview: 3,
    createdAt: '2024-01-10T09:00:00Z',
  },
  {
    id: '2',
    name: 'Cabinet Martin Conseil',
    siret: '98765432100029',
    email: 'martin@cabinet-conseil.fr',
    documentsCount: 3,
    invoicesToReview: 1,
    createdAt: '2024-01-15T11:00:00Z',
  },
  {
    id: '3',
    name: 'Boulangerie Moreau',
    siret: '55544433300012',
    email: 'moreau.boulangerie@gmail.com',
    documentsCount: 2,
    invoicesToReview: 0,
    createdAt: '2024-02-01T08:30:00Z',
  },
  {
    id: '4',
    name: 'Tech Innovations SAS',
    siret: '77788899900045',
    email: 'admin@tech-innovations.io',
    documentsCount: 5,
    invoicesToReview: 5,
    createdAt: '2024-02-10T14:00:00Z',
  },
];

// ─── Documents (fichiers bruts) ───────────────────────────────────────────────

export const documents: Document[] = [
  // SARL Dupont Construction
  { id: 'doc-101', clientId: '1', fileName: 'facture-edf-mars.pdf',       fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-01T10:00:00Z', status: 'processed', invoiceId: 'inv-101' },
  { id: 'doc-102', clientId: '1', fileName: 'facture-total-mars.pdf',     fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-05T14:00:00Z', status: 'processed', invoiceId: 'inv-102' },
  { id: 'doc-103', clientId: '1', fileName: 'facture-loxam-fev.pdf',      fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-20T09:00:00Z', status: 'processed', invoiceId: 'inv-103' },
  { id: 'doc-104', clientId: '1', fileName: 'facture-leroy-fev.jpg',      fileUrl: '', mimeType: 'image/jpeg',      uploadedAt: '2024-02-14T16:00:00Z', status: 'processed', invoiceId: 'inv-104' },
  { id: 'doc-105', clientId: '1', fileName: 'facture-orange-mars.pdf',    fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-10T11:00:00Z', status: 'processed', invoiceId: 'inv-105' },
  // Cabinet Martin Conseil
  { id: 'doc-201', clientId: '2', fileName: 'sfr-business-mars.pdf',      fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-08T10:00:00Z', status: 'processed', invoiceId: 'inv-201' },
  { id: 'doc-202', clientId: '2', fileName: 'scaleway-fev.pdf',           fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-28T09:00:00Z', status: 'processed', invoiceId: 'inv-202' },
  { id: 'doc-203', clientId: '2', fileName: 'maif-pro-2024.pdf',          fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-15T15:00:00Z', status: 'uploaded'  },
  // Boulangerie Moreau
  { id: 'doc-301', clientId: '3', fileName: 'minoterie-girard-mars.pdf',  fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-03T08:00:00Z', status: 'processed', invoiceId: 'inv-301' },
  { id: 'doc-302', clientId: '3', fileName: 'sodexo-mars.pdf',            fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-07T10:00:00Z', status: 'processed', invoiceId: 'inv-302' },
  // Tech Innovations SAS
  { id: 'doc-401', clientId: '4', fileName: 'aws-mars-2024.pdf',          fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-01T07:00:00Z', status: 'processed', invoiceId: 'inv-401' },
  { id: 'doc-402', clientId: '4', fileName: 'github-enterprise-mars.pdf', fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-03-01T07:05:00Z', status: 'processed', invoiceId: 'inv-402' },
  { id: 'doc-403', clientId: '4', fileName: 'figma-fev-2024.pdf',         fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-29T12:00:00Z', status: 'processed', invoiceId: 'inv-403' },
  { id: 'doc-404', clientId: '4', fileName: 'notion-fev.pdf',             fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-15T11:00:00Z', status: 'uploaded'  },
  { id: 'doc-405', clientId: '4', fileName: 'doctolib-fev.pdf',           fileUrl: '', mimeType: 'application/pdf', uploadedAt: '2024-02-10T09:00:00Z', status: 'processed', invoiceId: 'inv-405' },
];

// ─── Factures (données extraites) ─────────────────────────────────────────────

export const invoices: Invoice[] = [
  // SARL Dupont Construction
  { id: 'inv-101', documentId: 'doc-101', clientId: '1', supplierName: 'EDF Entreprises',  invoiceNumber: 'FAC-2024-0231', date: '2024-03-01', totalAmount: 1240.00, vatAmount: 206.67, status: 'to_review' },
  { id: 'inv-102', documentId: 'doc-102', clientId: '1', supplierName: 'Total Énergie',    invoiceNumber: 'TE-88421',      date: '2024-03-05', totalAmount: 3850.00, vatAmount: 641.67, status: 'to_review' },
  { id: 'inv-103', documentId: 'doc-103', clientId: '1', supplierName: 'Loxam Location',   invoiceNumber: 'LOX-2024-556',  date: '2024-02-20', totalAmount:  720.00, vatAmount: 120.00, status: 'validated' },
  { id: 'inv-104', documentId: 'doc-104', clientId: '1', supplierName: 'Leroy Merlin Pro', invoiceNumber: 'LM-9900124',    date: '2024-02-14', totalAmount: 4310.50, vatAmount: 718.42, status: 'validated' },
  { id: 'inv-105', documentId: 'doc-105', clientId: '1', supplierName: 'Orange Business',  invoiceNumber: 'OB-2024-003',   date: '2024-03-10', totalAmount:  189.60, vatAmount:  31.60, status: 'to_review' },
  // Cabinet Martin Conseil
  { id: 'inv-201', documentId: 'doc-201', clientId: '2', supplierName: 'SFR Business',     invoiceNumber: 'SFR-2024-1102', date: '2024-03-08', totalAmount:  310.80, vatAmount:  51.80, status: 'to_review' },
  { id: 'inv-202', documentId: 'doc-202', clientId: '2', supplierName: 'Scaleway',          invoiceNumber: 'SCW-20240228',  date: '2024-02-28', totalAmount:   87.24, vatAmount:  14.54, status: 'validated' },
  // Boulangerie Moreau
  { id: 'inv-301', documentId: 'doc-301', clientId: '3', supplierName: 'Minoterie Girard', invoiceNumber: 'MG-2024-015',   date: '2024-03-03', totalAmount: 2100.00, vatAmount: 105.00, status: 'validated' },
  { id: 'inv-302', documentId: 'doc-302', clientId: '3', supplierName: 'Sodexo France',    invoiceNumber: 'SDX-44892',     date: '2024-03-07', totalAmount:  540.00, vatAmount:  54.00, status: 'validated' },
  // Tech Innovations SAS
  { id: 'inv-401', documentId: 'doc-401', clientId: '4', supplierName: 'AWS EMEA',          invoiceNumber: 'AWS-EU-20240301',  date: '2024-03-01', totalAmount: 5420.00, vatAmount:  903.33, status: 'to_review' },
  { id: 'inv-402', documentId: 'doc-402', clientId: '4', supplierName: 'GitHub Enterprise', invoiceNumber: 'GH-ENT-2024-03',   date: '2024-03-01', totalAmount: 2100.00, vatAmount:  350.00, status: 'to_review' },
  { id: 'inv-403', documentId: 'doc-403', clientId: '4', supplierName: 'Figma Inc.',        invoiceNumber: 'FIG-2024-0098',    date: '2024-02-29', totalAmount:  480.00, vatAmount:   80.00, status: 'to_review' },
  { id: 'inv-405', documentId: 'doc-405', clientId: '4', supplierName: 'Doctolib',          invoiceNumber: 'DOC-20240210',     date: '2024-02-10', totalAmount:  159.00, vatAmount:   26.50, status: 'to_review' },
];
