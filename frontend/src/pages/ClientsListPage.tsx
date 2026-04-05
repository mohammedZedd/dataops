import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, X, CheckCircle, User, Mail, Phone, Building2, Calendar, Ban, Pencil, Lock, Eye, Trash2, Plus, ChevronsUpDown, Search, FolderOpen, FileText, ImageIcon, FileSpreadsheet, File, ChevronDown, ChevronUp, ChevronRight, Download, Briefcase, ClipboardList, Loader2, Mic, RotateCcw } from 'lucide-react';
import { SECTEURS_ACTIVITE, REGIMES_FISCAUX, FORMES_JURIDIQUES } from '../types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { getClientUsers, revokeClientAccess, restoreClientAccess, updateClientUser } from '../api/clients';
import { getClientDocuments, getPresignedDownloadUrl, createInvoiceFromDocument } from '../api/documents';
import type { AdminClientDoc } from '../api/documents';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import InviteClientModal from '../features/invitations/InviteClientModal';
import type { ClientUser } from '../types';

// ─── Confirmation modal (portal) ─────────────────────────────────────────────

interface ConfirmRevokeModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmRevokeModal({ onConfirm, onCancel }: ConfirmRevokeModalProps) {
  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        onClick={onCancel}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420, background: '#fff', borderRadius: 12,
        padding: '24px 32px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        zIndex: 10000,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            height: 48, width: 48, borderRadius: '50%',
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 22 }}>!</span>
          </div>
        </div>
        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>
          Révoquer l'accès
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
          Êtes-vous sûr de vouloir révoquer l'accès de ce client ? Il ne pourra plus se connecter à la plateforme.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 42, fontSize: 14, fontWeight: 500,
              color: '#4B5563', background: '#fff',
              border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="hover:bg-red-600 transition-colors"
            style={{
              flex: 1, height: 42, fontSize: 14, fontWeight: 500,
              color: '#fff', background: '#EF4444',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Client detail drawer ─────────────────────────────────────────────────────

interface DetailDrawerProps {
  client: ClientUser;
  onClose: () => void;
  onRevoked: (id: string) => void;
  onUpdated: (updated: ClientUser) => void;
  initialEditMode?: boolean;
}

const INPUT_STYLE = {
  width: '100%', padding: '8px 12px', fontSize: 14,
  border: '1px solid #D1D5DB', borderRadius: 6,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

function DetailDrawer({ client, onClose, onRevoked, onUpdated, initialEditMode }: DetailDrawerProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [revoking,    setRevoking]    = useState(false);
  const [isActive,    setIsActive]    = useState(client.is_active);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit mode
  const [editMode,     setEditMode]     = useState(initialEditMode ?? false);
  const [editFirst,    setEditFirst]    = useState(client.first_name);
  const [editLast,     setEditLast]     = useState(client.last_name);
  const [editPhone,    setEditPhone]    = useState(client.phone_number ?? '');
  const [editCompany,  setEditCompany]  = useState(client.client_company_name ?? '');
  const [editSecteur,  setEditSecteur]  = useState(client.secteur_activite ?? '');
  const [editRegime,   setEditRegime]   = useState(client.regime_fiscal ?? '');
  const [editForme,    setEditForme]    = useState(client.forme_juridique ?? '');
  const [saving,       setSaving]       = useState(false);
  const [editError,    setEditError]    = useState<string | null>(null);

  function enterEdit() {
    setEditFirst(client.first_name);
    setEditLast(client.last_name);
    setEditPhone(client.phone_number ?? '');
    setEditCompany(client.client_company_name ?? '');
    setEditSecteur(client.secteur_activite ?? '');
    setEditRegime(client.regime_fiscal ?? '');
    setEditForme(client.forme_juridique ?? '');
    setEditError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditError(null);
  }

  async function handleSave() {
    const firstName = editFirst.trim();
    const lastName  = editLast.trim();
    if (firstName.length < 1 || lastName.length < 1) {
      setEditError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (firstName.length + lastName.length < 2) {
      setEditError('Le nom complet doit contenir au moins 2 caractères.');
      return;
    }
    if (editPhone.trim() && editPhone.trim().length < 6) {
      setEditError('Le numéro de téléphone semble invalide.');
      return;
    }
    setEditError(null);
    setSaving(true);
    try {
      const updated = await updateClientUser(client.id, {
        first_name:       firstName,
        last_name:        lastName,
        phone_number:     editPhone.trim() || undefined,
        company_name:     editCompany.trim() || undefined,
        secteur_activite: editSecteur || undefined,
        regime_fiscal: editRegime || undefined,
        forme_juridique: editForme || undefined,
      });
      onUpdated(updated);
      setEditMode(false);
    } catch {
      setEditError('Impossible de mettre à jour les informations.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setShowConfirm(false);
    setRevoking(true);
    setActionError(null);
    try {
      await revokeClientAccess(client.id);
      setIsActive(false);
      onRevoked(client.id);
    } catch {
      setActionError("Impossible de révoquer l'accès. Veuillez réessayer.");
    } finally {
      setRevoking(false);
    }
  }

  const initials = `${client.first_name.charAt(0)}${client.last_name.charAt(0)}`.toUpperCase();

  return createPortal(
    <>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}
        onClick={editMode ? undefined : onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
        zIndex: 10000,
        display: 'flex', flexDirection: 'column',
        animation: 'modalIn 200ms ease-out forwards',
      }}>

        {/* Header */}
        <div style={{
          background: '#F8FAFC', padding: 24,
          borderRadius: '16px 16px 0 0', borderBottom: '1px solid #E5E7EB',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              height: 52, width: 52, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 600,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                  {client.first_name} {client.last_name}
                </span>
                {isActive ? (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#DCFCE7', color: '#16A34A' }}>Actif</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#F3F4F6', color: '#9CA3AF' }}>Inactif</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                {editMode ? 'Modifier les informations' : 'Détails du client'}
              </p>
            </div>
          </div>
          {!editMode && (
            <button
              onClick={onClose}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E5E7EB'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              style={{
                position: 'absolute', top: 16, right: 16,
                height: 32, width: 32, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', transition: 'background 0.15s',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Info rows */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* NOM */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <User size={15} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Nom complet
              </p>
              {editMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} placeholder="Prénom" style={INPUT_STYLE} />
                  <input value={editLast}  onChange={(e) => setEditLast(e.target.value)}  placeholder="Nom"    style={INPUT_STYLE} />
                </div>
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{client.first_name} {client.last_name}</p>
              )}
            </div>
          </div>

          {/* EMAIL — always read-only */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{ height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={15} color="#7C3AED" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Email</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{client.email}</p>
            </div>
            {editMode && <Lock size={13} color="#9CA3AF" style={{ flexShrink: 0 }} />}
          </div>

          {/* TÉLÉPHONE */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#F0FDF4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <Phone size={15} color="#16A34A" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Téléphone
              </p>
              {editMode ? (
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+33 6 12 34 56 78" style={INPUT_STYLE} />
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{client.phone_number ?? '—'}</p>
              )}
            </div>
          </div>

          {/* ENTREPRISE */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#FFF7ED',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <Building2 size={15} color="#EA580C" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Entreprise
              </p>
              {editMode ? (
                <input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Nom de l'entreprise" style={INPUT_STYLE} />
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{client.client_company_name ?? '—'}</p>
              )}
            </div>
          </div>

          {/* SECTEUR D'ACTIVITÉ */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <Briefcase size={15} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Secteur d'activité
              </p>
              {editMode ? (
                <SearchableSelect options={SECTEURS_ACTIVITE} value={editSecteur} onChange={setEditSecteur} placeholder="Rechercher un secteur…" />
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: client.secteur_activite ? '#111827' : '#9CA3AF' }}>
                  {client.secteur_activite ?? '—'}
                </p>
              )}
            </div>
          </div>

          {/* RÉGIME FISCAL */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <FileText size={15} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Régime fiscal
              </p>
              {editMode ? (
                <SearchableSelect options={REGIMES_FISCAUX} value={editRegime} onChange={setEditRegime} placeholder="Rechercher un régime…" />
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: client.regime_fiscal ? '#111827' : '#9CA3AF' }}>
                  {client.regime_fiscal ?? '—'}
                </p>
              )}
            </div>
          </div>

          {/* FORME JURIDIQUE */}
          <div style={{
            display: 'flex', alignItems: editMode ? 'flex-start' : 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{
              height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: editMode ? 4 : 0,
            }}>
              <Building2 size={15} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: editMode ? 6 : 2 }}>
                Forme juridique
              </p>
              {editMode ? (
                <SearchableSelect options={FORMES_JURIDIQUES} value={editForme} onChange={setEditForme} placeholder="Rechercher une forme…" />
              ) : (
                <p style={{ fontSize: 14, fontWeight: 500, color: client.forme_juridique ? '#111827' : '#9CA3AF' }}>
                  {client.forme_juridique ?? '—'}
                </p>
              )}
            </div>
          </div>

          {/* INSCRIPTION — always display */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', background: '#F9FAFB',
            border: '1px solid #E5E7EB', borderRadius: 8,
          }}>
            <div style={{ height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={15} color="#6B7280" />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Inscription</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                {new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {(actionError || editError) && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#DC2626',
            }}>
              {actionError ?? editError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 12 }}>
          {editMode ? (
            <>
              <button
                onClick={cancelEdit}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: '#4B5563', background: '#fff',
                  border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: '#fff', background: saving ? '#93C5FD' : '#3B82F6',
                  border: 'none', borderRadius: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: '#4B5563', background: '#fff',
                  border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Fermer
              </button>
              <button
                onClick={isActive ? enterEdit : undefined}
                disabled={!isActive}
                onMouseEnter={(e) => { if (isActive) (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; }}
                onMouseLeave={(e) => { if (isActive) (e.currentTarget as HTMLButtonElement).style.background = isActive ? '#fff' : '#F3F4F6'; }}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: isActive ? '#3B82F6' : '#9CA3AF',
                  background: isActive ? '#fff' : '#F3F4F6',
                  border: `1px solid ${isActive ? '#3B82F6' : '#E5E7EB'}`,
                  borderRadius: 8, cursor: isActive ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                <Pencil size={14} />
                Modifier
              </button>
              {isActive ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={revoking}
                  onMouseEnter={(e) => { if (!revoking) (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                  style={{
                    flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                    color: '#EF4444', background: '#fff',
                    border: '1px solid #EF4444', borderRadius: 8,
                    cursor: revoking ? 'not-allowed' : 'pointer',
                    opacity: revoking ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  <Ban size={15} />
                  {revoking ? 'Révocation…' : "Révoquer"}
                </button>
              ) : (
                <div style={{
                  flex: 1, height: 42, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, fontWeight: 500,
                  color: '#9CA3AF', background: '#F9FAFB',
                  border: '1px solid #E5E7EB', borderRadius: 8,
                }}>
                  Accès révoqué
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showConfirm && (
        <ConfirmRevokeModal
          onConfirm={handleRevoke}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>,
    document.body
  );
}

// ─── Client documents modal ───────────────────────────────────────────────────

interface ClientDocsModalProps {
  client: ClientUser;
  onClose: () => void;
  onNavigateToInvoice: (clientId: string, invoiceId: string) => void;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')                                         return <FileText    size={18} color="#EF4444" />;
  if (['jpg', 'jpeg', 'png'].includes(ext))                  return <ImageIcon   size={18} color="#3B82F6" />;
  if (['xlsx', 'xls'].includes(ext))                         return <FileSpreadsheet size={18} color="#16A34A" />;
  if (['webm', 'mp3', 'mp4', 'ogg', 'wav'].includes(ext))   return <Mic         size={18} color="#7C3AED" />;
  return <File size={18} color="#6B7280" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024)             return `${bytes} o`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function groupByMonth(docs: AdminClientDoc[]): { key: string; label: string; docs: AdminClientDoc[] }[] {
  const map: Record<string, AdminClientDoc[]> = {};
  for (const doc of docs) {
    const d   = new Date(doc.uploaded_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(doc);
  }
  return Object.keys(map)
    .sort()
    .reverse()
    .map((key) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { key, label: label.charAt(0).toUpperCase() + label.slice(1), docs: map[key] };
    });
}

function isAudioDoc(doc: AdminClientDoc): boolean {
  return doc.doc_type === 'audio' || /\.(webm|mp3|mp4|ogg|wav)$/i.test(doc.file_name);
}

function ClientDocsModal({ client, onClose, onNavigateToInvoice }: ClientDocsModalProps) {
  const [docs,     setDocs]     = useState<AdminClientDoc[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [playingAudioId,  setPlayingAudioId]  = useState<string | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!client.client_id) { setLoading(false); return; }
    getClientDocuments(client.client_id)
      .then((data) => {
        setDocs(data);
        const groups = groupByMonth(data);
        if (groups.length > 0) setExpanded(new Set([groups[0].key]));
      })
      .catch(() => setError('Impossible de charger les documents.'))
      .finally(() => setLoading(false));
  }, [client.client_id]);

  function toggleMonth(key: string) {
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDownload(docId: string) {
    try {
      const url = await getPresignedDownloadUrl(docId);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  }

  async function handleCreateInvoice(docId: string) {
    if (!client.client_id) return;
    setCreatingInvoice(docId);
    try {
      const invoice = await createInvoiceFromDocument(docId);
      onClose();
      onNavigateToInvoice(client.client_id, invoice.id);
    } catch {
      setError('Impossible de créer la facture.');
    } finally {
      setCreatingInvoice(null);
    }
  }

  function handleViewInvoice(invoiceId: string) {
    if (!client.client_id) return;
    onClose();
    onNavigateToInvoice(client.client_id, invoiceId);
  }

  async function toggleAudioPlay(docId: string) {
    if (playingAudioId === docId) {
      setPlayingAudioId(null);
      setPlayingAudioUrl(null);
      return;
    }
    try {
      const url = await getPresignedDownloadUrl(docId);
      setPlayingAudioId(docId);
      setPlayingAudioUrl(url);
    } catch { /* ignore */ }
  }

  const initials = `${client.first_name.charAt(0)}${client.last_name.charAt(0)}`.toUpperCase();
  const groups   = groupByMonth(docs);

  return createPortal(
    <>
      <style>{`
        @keyframes docsModalIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 780, maxHeight: '80vh',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
        zIndex: 10000,
        display: 'flex', flexDirection: 'column',
        animation: 'docsModalIn 200ms ease-out forwards',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          background: '#F8FAFC', borderRadius: '16px 16px 0 0',
        }}>
          <div style={{
            height: 44, width: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 16, fontWeight: 700,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>
              {client.first_name} {client.last_name}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Documents envoyés</p>
          </div>
          {!loading && !error && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
              background: '#EFF6FF', color: '#3B82F6', whiteSpace: 'nowrap',
            }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''} au total
            </span>
          )}
          <button
            onClick={onClose}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E5E7EB'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            style={{
              height: 32, width: 32, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{
                height: 24, width: 24, borderRadius: '50%',
                border: '2px solid #3B82F6', borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : error ? (
            <p style={{ textAlign: 'center', padding: '40px 24px', fontSize: 14, color: '#EF4444' }}>{error}</p>
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{
                height: 52, width: 52, borderRadius: '50%', background: '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}>
                <FolderOpen size={24} color="#9CA3AF" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucun document</p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Ce client n'a encore envoyé aucun document.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
              {groups.map(({ key, label, docs: groupDocs }) => (
                <div key={key} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB' }}>

                  {/* Month header */}
                  <button
                    onClick={() => toggleMonth(key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', background: '#F8FAFC',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
                  >
                    <Calendar size={15} color="#6B7280" />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12,
                      background: '#F3F4F6', color: '#6B7280',
                    }}>
                      {groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}
                    </span>
                    {expanded.has(key)
                      ? <ChevronUp size={15} color="#6B7280" />
                      : <ChevronDown size={15} color="#6B7280" />}
                  </button>

                  {/* Document rows */}
                  {expanded.has(key) && groupDocs.map((doc, idx) => (
                    <div key={doc.id}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px',
                        borderTop: '1px solid #F3F4F6',
                        background: '#fff',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                    >
                      {/* File icon */}
                      <div style={{
                        height: 36, width: 36, borderRadius: 8, background: '#F9FAFB',
                        border: '1px solid #E5E7EB', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {fileIcon(doc.file_name)}
                      </div>

                      {/* Name + size */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 14, fontWeight: 500, color: '#111827',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {doc.file_name}
                        </p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {formatBytes(doc.file_size)}
                        </p>
                      </div>

                      {/* Badge: Audio / Invoice status / Aucune facture */}
                      {isAudioDoc(doc) ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap', flexShrink: 0, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                          Audio
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                          whiteSpace: 'nowrap', flexShrink: 0,
                          background: !doc.invoice_id ? '#F3F4F6'
                            : doc.invoice_status === 'validated' ? '#DCFCE7'
                            : doc.invoice_status === 'rejected' ? '#FEE2E2'
                            : '#FEF3C7',
                          color: !doc.invoice_id ? '#9CA3AF'
                            : doc.invoice_status === 'validated' ? '#16A34A'
                            : doc.invoice_status === 'rejected' ? '#DC2626'
                            : '#92400E',
                        }}>
                          {!doc.invoice_id ? 'Aucune facture'
                            : doc.invoice_status === 'validated' ? 'Validée'
                            : doc.invoice_status === 'rejected' ? 'Rejetée'
                            : 'À traiter'}
                        </span>
                      )}

                      {/* Upload date */}
                      <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>

                      {/* Action button: play audio OR view/create invoice */}
                      {isAudioDoc(doc) ? (
                        <button
                          onClick={() => toggleAudioPlay(doc.id)}
                          title={playingAudioId === doc.id ? 'Arrêter' : 'Écouter'}
                          style={{
                            height: 32, width: 32, borderRadius: 8, border: 'none',
                            background: playingAudioId === doc.id ? '#F5F3FF' : 'transparent',
                            cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#7C3AED', transition: 'all 0.15s',
                          }}
                        >
                          {playingAudioId === doc.id ? <X size={15} /> : <Eye size={15} />}
                        </button>
                      ) : doc.invoice_id ? (
                        <button
                          onClick={() => handleViewInvoice(doc.invoice_id!)}
                          title="Voir la facture"
                          style={{
                            height: 32, width: 32, borderRadius: 8, border: 'none',
                            background: 'transparent', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#16A34A', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#DCFCE7'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <Eye size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCreateInvoice(doc.id)}
                          disabled={creatingInvoice === doc.id}
                          title="Créer une facture manuellement"
                          style={{
                            height: 32, width: 32, borderRadius: 8, border: 'none',
                            background: 'transparent', cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#9CA3AF', transition: 'all 0.15s',
                            opacity: creatingInvoice === doc.id ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#EFF6FF'; b.style.color = '#3B82F6'; }}
                          onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#9CA3AF'; }}
                        >
                          {creatingInvoice === doc.id ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />}
                        </button>
                      )}

                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(doc.id)}
                        title="Télécharger"
                        style={{
                          height: 32, width: 32, borderRadius: 8, border: 'none',
                          background: 'transparent', cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#9CA3AF', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          const b = e.currentTarget as HTMLButtonElement;
                          b.style.background = '#EFF6FF'; b.style.color = '#3B82F6';
                        }}
                        onMouseLeave={(e) => {
                          const b = e.currentTarget as HTMLButtonElement;
                          b.style.background = 'transparent'; b.style.color = '#9CA3AF';
                        }}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                    {/* Inline audio player */}
                    {playingAudioId === doc.id && playingAudioUrl && (
                      <div style={{
                        padding: '12px 20px 12px 48px', background: '#F5F3FF',
                        borderTop: '1px solid #DDD6FE',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, textTransform: 'uppercase' }}>Note vocale</span>
                          <button onClick={() => setPlayingAudioId(null)}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }}>
                            <X size={14} />
                          </button>
                        </div>
                        <audio controls autoPlay style={{ width: '100%', height: 32 }} src={playingAudioUrl} />
                        {doc.description && (
                          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>{doc.description}</p>
                        )}
                      </div>
                    )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientsListPage() {
  const navigate = useNavigate();
  const [clients,       setClients]       = useState<ClientUser[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [selected,      setSelected]      = useState<ClientUser | null>(null);
  const [openInEdit,    setOpenInEdit]    = useState(false);
  const [revokeTarget,      setRevokeTarget]      = useState<ClientUser | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ClientUser | null>(null);
  const [revoking,      setRevoking]      = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [docsTarget,    setDocsTarget]    = useState<ClientUser | null>(null);
  const [successToast,  setSuccessToast]  = useState<'revoked' | 'updated' | 'reactivated' | null>(null);

  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    getClientUsers()
      .then(setClients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  function showToast(type: 'revoked' | 'updated') {
    setSuccessToast(type);
    setTimeout(() => setSuccessToast(null), 3000);
  }

  function handleRevoked(userId: string) {
    setClients((prev) => prev.map((c) => c.id === userId ? { ...c, is_active: false } : c));
    if (selected?.id === userId) setSelected((prev) => prev ? { ...prev, is_active: false } : null);
    showToast('revoked');
  }

  function handleUpdated(updated: ClientUser) {
    setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelected(updated);
    showToast('updated');
  }

  async function handleRevokeFromTable() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeClientAccess(revokeTarget.id);
      setClients((prev) => prev.map((c) => c.id === revokeTarget.id ? { ...c, is_active: false } : c));
      if (selected?.id === revokeTarget.id) setSelected((prev) => prev ? { ...prev, is_active: false } : null);
      showToast('revoked');
    } catch {
      // silently ignore — user will retry
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  async function handleReactivateFromTable() {
    if (!reactivateTarget) return;
    setRevoking(true);
    try {
      await restoreClientAccess(reactivateTarget.id);
      setClients((prev) => prev.map((c) => c.id === reactivateTarget.id ? { ...c, is_active: true } : c));
      if (selected?.id === reactivateTarget.id) setSelected((prev) => prev ? { ...prev, is_active: true } : null);
      setSuccessToast('reactivated');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch { /* ignore */ }
    finally {
      setRevoking(false);
      setReactivateTarget(null);
    }
  }

  function openDetail(c: ClientUser, editMode = false) {
    setOpenInEdit(editMode);
    setSelected(c);
  }

  // ─── Search ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  function normalize(s: string) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  const q = normalize(search.trim());
  const filtered: ClientUser[] = q.length === 0 ? clients : clients.filter((c: ClientUser) => {
    const haystack = normalize(
      `${c.first_name} ${c.last_name} ${c.email} ${c.client_company_name ?? ''}`
    );
    return haystack.includes(q);
  });

  // Highlights matching substring with yellow bg; returns plain text if no query
  function Highlight({ text }: { text: string }) {
    if (!q) return <>{text}</>;
    const norm = normalize(text);
    const idx  = norm.indexOf(q);
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#FEF9C3', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  const COLS = ['NOM', 'EMAIL', 'TÉLÉPHONE', 'ENTREPRISE', 'INSCRIPTION', 'DOCUMENTS', 'STATUT', 'ACTIONS', ''];

  return (
    <>
      {/* Toast */}
      <div className={`fixed top-16 right-4 z-[10001] flex items-center gap-2.5 bg-white border border-green-200
        rounded-xl shadow-lg px-4 py-3 transition-all duration-300
        ${successToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
      >
        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-800">
          {successToast === 'updated' ? 'Informations mises à jour' : successToast === 'reactivated' ? "L'accès du client a été réactivé avec succès" : 'Accès révoqué avec succès'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Page header */}
        <div className="pb-5 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
        </div>

        {error && <ErrorBanner message={error} onRetry={fetchClients} />}

        {!loading && !error && (
          <>
            {/* Top bar: count + invite button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, color: '#6B7280' }}>
                {q
                  ? `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''} pour « ${search.trim()} »`
                  : `${clients.length} client${clients.length !== 1 ? 's' : ''} inscrit${clients.length !== 1 ? 's' : ''}`
                }
              </p>
              <button
                onClick={() => setShowInvite(true)}
                style={{
                  height: 38, padding: '0 16px', background: '#3B82F6', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2563EB'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#3B82F6'; }}
              >
                <Plus size={15} />
                Inviter un client
              </button>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                color="#9CA3AF"
                style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, entreprise..."
                style={{
                  width: '100%', height: 42, paddingLeft: 40, paddingRight: search ? 36 : 14,
                  fontSize: 14, color: '#111827',
                  border: '1px solid #E5E7EB', borderRadius: 10,
                  background: '#fff', outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#3B82F6';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#E5E7EB';
                  (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    height: 20, width: 20, borderRadius: '50%', border: 'none',
                    background: '#E5E7EB', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#D1D5DB'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#E5E7EB'; }}
                >
                  <X size={11} color="#6B7280" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Table card */}
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Users size={18} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Aucun client inscrit</p>
              <p className="text-sm text-gray-400 mt-1">
                Les clients apparaissent ici après avoir accepté leur invitation.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-11 w-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Search size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Aucun client trouvé</p>
              <p className="text-sm text-gray-400 mt-1">
                Aucun résultat pour « {search.trim()} »
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {/* Dark header */}
              <thead>
                <tr style={{ background: '#1E2A4A' }}>
                  {COLS.map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left', padding: '14px 12px',
                        fontSize: 12, fontWeight: 500, color: '#fff',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col !== 'ACTIONS' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {col}
                          <ChevronsUpDown size={11} color="rgba(255,255,255,0.4)" />
                        </span>
                      ) : col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((c, idx) => {
                  const accentColor = c.is_active ? '#22C55E' : '#9CA3AF';
                  const fullName = `${c.first_name} ${c.last_name}`;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => c.client_id && navigate(`/clients/${c.client_id}`)}
                      style={{
                        borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                        boxShadow: `inset 4px 0 0 0 ${accentColor}`,
                        transition: 'background 0.12s',
                        background: '#fff',
                        cursor: c.client_id ? 'pointer' : 'default',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#fff'; }}
                    >
                      {/* NOM + status label */}
                      <td style={{ padding: '16px 12px', paddingLeft: 16 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                          <Highlight text={fullName} />
                        </p>
                        <p style={{ fontSize: 11, marginTop: 2, color: c.is_active ? '#16A34A' : '#9CA3AF' }}>
                          {c.is_active ? 'Actif' : 'Inactif'}
                        </p>
                      </td>

                      {/* EMAIL */}
                      <td style={{ padding: '16px 12px', fontSize: 13, color: '#374151', maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Highlight text={c.email} />
                        </span>
                      </td>

                      {/* TÉLÉPHONE */}
                      <td style={{ padding: '16px 12px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {c.phone_number ?? '—'}
                      </td>

                      {/* ENTREPRISE */}
                      <td style={{ padding: '16px 12px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                        <Highlight text={c.client_company_name ?? '—'} />
                      </td>

                      {/* INSCRIPTION */}
                      <td style={{ padding: '16px 12px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </td>

                      {/* DOCUMENTS */}
                      <td style={{ padding: '16px 12px' }} onClick={e => e.stopPropagation()}>
                        {c.client_id ? (
                          <button
                            onClick={() => navigate(`/clients/${c.client_id}?tab=documents`)}
                            style={{
                              fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                              background: (c.documents_count ?? 0) > 0 ? '#EFF6FF' : '#F3F4F6',
                              color:      (c.documents_count ?? 0) > 0 ? '#3B82F6' : '#9CA3AF',
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={(e: any) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.75'; }}
                            onMouseLeave={(e: any) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                          >
                            {(c.documents_count ?? 0) > 0
                              ? `${c.documents_count} doc${(c.documents_count ?? 0) > 1 ? 's' : ''}`
                              : 'Aucun doc'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
                        )}
                      </td>

                      {/* STATUT */}
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                          whiteSpace: 'nowrap',
                          background: c.is_active ? '#DCFCE7' : '#F3F4F6',
                          color: c.is_active ? '#16A34A' : '#6B7280',
                        }}>
                          {c.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '16px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {/* Edit — disabled when inactive */}
                          <button
                            onClick={c.is_active ? () => openDetail(c, true) : undefined}
                            title={c.is_active ? 'Modifier' : undefined}
                            className={c.is_active
                              ? 'flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors rounded-lg'
                              : 'flex items-center justify-center rounded-lg'}
                            style={{
                              height: 32, width: 32,
                              color: c.is_active ? undefined : '#D1D5DB',
                              opacity: c.is_active ? undefined : 0.35,
                              cursor: c.is_active ? 'pointer' : 'not-allowed',
                              pointerEvents: c.is_active ? undefined : 'none',
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          {/* Revoke / Reactivate based on status */}
                          {c.is_active ? (
                            <button
                              onClick={() => setRevokeTarget(c)}
                              title="Limiter l'accès"
                              className="flex items-center justify-center text-gray-400
                                hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                              style={{ height: 32, width: 32 }}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setReactivateTarget(c)}
                              title="Réactiver l'accès"
                              className="flex items-center justify-center text-emerald-500
                                hover:text-emerald-600 hover:bg-emerald-50 transition-colors rounded-lg"
                              style={{ height: 32, width: 32, cursor: 'pointer' }}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Navigate arrow — NOT inside stopPropagation */}
                      <td style={{ padding: '16px 4px 16px 0', width: 20 }}>
                        {c.client_id && <ChevronRight size={15} color="#D1D5DB" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <DetailDrawer
          key={`${selected.id}-${openInEdit ? 'edit' : 'view'}`}
          client={selected}
          onClose={() => setSelected(null)}
          onRevoked={handleRevoked}
          onUpdated={handleUpdated}
          initialEditMode={openInEdit}
        />
      )}

      {/* Revoke confirmation (from table trash icon) */}
      {revokeTarget && (
        <ConfirmRevokeModal
          onConfirm={handleRevokeFromTable}
          onCancel={() => !revoking && setRevokeTarget(null)}
        />
      )}

      {/* Reactivate confirmation */}
      {reactivateTarget && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}
            onClick={() => !revoking && setReactivateTarget(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 380, background: '#fff', borderRadius: 16, zIndex: 10000, padding: '28px 24px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <div style={{ height: 48, width: 48, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={22} color="#16A34A" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Réactiver l'accès</p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                Voulez-vous réactiver l'accès de <strong>{reactivateTarget.first_name} {reactivateTarget.last_name}</strong> ?
                Il/Elle pourra à nouveau se connecter et envoyer des documents.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setReactivateTarget(null)} disabled={revoking}
                style={{ flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleReactivateFromTable} disabled={revoking}
                style={{ flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', opacity: revoking ? 0.6 : 1 }}>
                {revoking ? 'Réactivation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Invite client modal */}
      {showInvite && (
        <InviteClientModal
          onClose={() => setShowInvite(false)}
          onCreated={() => setShowInvite(false)}
          onReactivated={() => {
            setShowInvite(false);
            setSuccessToast('reactivated');
            setTimeout(() => setSuccessToast(null), 3000);
            fetchClients();
          }}
        />
      )}

      {/* Client documents modal */}
      {docsTarget && (
        <ClientDocsModal
          client={docsTarget}
          onClose={() => setDocsTarget(null)}
          onNavigateToInvoice={(clientId, invoiceId) => {
            setDocsTarget(null);
            navigate(`/clients/${clientId}/invoices/${invoiceId}`);
          }}
        />
      )}
    </>
  );
}
