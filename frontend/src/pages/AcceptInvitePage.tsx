import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Lock, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { acceptInvitation, getInvitationByToken } from '../api/invitations';
import { useAuth } from '../context/AuthContext';
import { SECTEURS_ACTIVITE, REGIMES_FISCAUX, FORMES_JURIDIQUES } from '../types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import type { InvitationPublic } from '../types';

const INPUT =
  'w-full h-[44px] px-3 text-[13px] border border-gray-200 rounded-lg ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'focus:border-blue-400 transition-colors bg-white';

const SELECT =
  'w-full h-[44px] px-3 text-[13px] border border-gray-200 rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors bg-white';

const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5';

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-[11px] text-red-500 mt-1">{msg}</p> : null;
}

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '#E5E7EB', width: '0%' };
  const hasNum = /\d/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const score = (pw.length >= 8 ? 1 : 0) + (hasNum ? 1 : 0) + (hasUpper ? 1 : 0) + (hasSpecial ? 1 : 0);
  if (score <= 1) return { label: 'Faible', color: '#EF4444', width: '33%' };
  if (score <= 2) return { label: 'Moyen', color: '#F59E0B', width: '66%' };
  return { label: 'Fort', color: '#16A34A', width: '100%' };
}

type PageState = 'loading' | 'invalid' | 'already_accepted' | 'form';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invite, setInvite] = useState<InvitationPublic | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-step
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 1 — Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Step 2 — Company
  const [companyName, setCompanyName] = useState('');
  const [secteur, setSecteur] = useState('');
  const [forme, setForme] = useState('');
  const [regime, setRegime] = useState('');

  // Step 3 — Fiscal IDs
  const [ice, setIce] = useState('');
  const [ifNumber, setIfNumber] = useState('');
  const [rc, setRc] = useState('');
  const [tp, setTp] = useState('');
  const [cnss, setCnss] = useState('');

  useEffect(() => {
    if (!token) { setErrorMsg("Lien d'invitation invalide."); setPageState('invalid'); return; }
    getInvitationByToken(token)
      .then(data => {
        setInvite(data);
        setFirstName(data.first_name);
        setLastName(data.last_name);
        if (data.client_company_name) setCompanyName(data.client_company_name);
        setPageState('form');
      })
      .catch((err: unknown) => {
        if (err instanceof AxiosError) {
          if (err.response?.status === 409) { setPageState('already_accepted'); return; }
          if (err.response?.status === 410) { setErrorMsg("Ce lien d'invitation a expiré."); setPageState('invalid'); return; }
          setErrorMsg(err.response?.data?.detail ?? 'Invitation invalide.');
        } else { setErrorMsg('Erreur réseau.'); }
        setPageState('invalid');
      });
  }, [token]);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (firstName.trim().length < 2) errs.firstName = 'Min 2 caractères';
    if (lastName.trim().length < 2) errs.lastName = 'Min 2 caractères';
    if (!phone.trim()) errs.phone = 'Requis';
    if (password.length < 8) errs.password = 'Min 8 caractères';
    if (password !== confirm) errs.confirm = 'Ne correspond pas';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (companyName.trim().length < 2) errs.companyName = 'Requis';
    if (!secteur) errs.secteur = 'Sélectionnez un secteur';
    if (!forme) errs.forme = 'Sélectionnez une forme';
    if (!regime) errs.regime = 'Sélectionnez un régime';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (ice && !/^\d{15}$/.test(ice)) errs.ice = 'Exactement 15 chiffres';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep3()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const { access_token, user } = await acceptInvitation({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        password,
        company_name: companyName.trim() || undefined,
        secteur_activite: secteur || undefined,
        forme_juridique: forme || undefined,
        regime_fiscal: regime || undefined,
        ice: ice.trim() || undefined,
        if_number: ifNumber.trim() || undefined,
        rc: rc.trim() || undefined,
        tp: tp.trim() || undefined,
        cnss: cnss.trim() || undefined,
      });
      setAuth(access_token, user);
      navigate('/');
    } catch (err: unknown) {
      setFormError(err instanceof AxiosError ? err.response?.data?.detail ?? "Erreur d'inscription." : "Erreur d'inscription.");
    } finally {
      setSubmitting(false);
    }
  }

  const pwStr = passwordStrength(password);

  // ─── Non-form states ─────────────────────────────────────────────────────

  if (pageState !== 'form' || !invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="bg-white rounded-2xl border border-gray-100 p-8" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
            {pageState === 'loading' && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-gray-400">Vérification de l'invitation…</p>
              </div>
            )}
            {pageState === 'invalid' && (
              <div className="text-center py-4">
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3"><span className="text-red-500 text-lg">✕</span></div>
                <h1 className="text-[16px] font-bold text-gray-900 mb-1">Lien invalide</h1>
                <p className="text-[13px] text-gray-500 mb-5">{errorMsg}</p>
                <Link to="/login" className="text-[13px] font-medium text-blue-600 hover:underline">Retour à la connexion</Link>
              </div>
            )}
            {pageState === 'already_accepted' && (
              <div className="text-center py-4">
                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3"><span className="text-emerald-500 text-lg">✓</span></div>
                <h1 className="text-[16px] font-bold text-gray-900 mb-1">Invitation déjà utilisée</h1>
                <p className="text-[13px] text-gray-500 mb-5">Connectez-vous avec votre compte.</p>
                <Link to="/login" className="text-[13px] font-medium text-blue-600 hover:underline">Se connecter</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Multi-step form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full" style={{ maxWidth: 480 }}>
        <Logo />

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-colors
                ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Cabinet badge */}
        {invite.company_name && (
          <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">Cabinet</span>
            <span className="text-[13px] font-medium text-blue-700">{invite.company_name}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {formError && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-[12px] text-red-700">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* ═══ Step 1 — Personal ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-[16px] font-bold text-gray-900 mb-1">Informations personnelles</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Prénom <span className="text-red-400">*</span></label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" className={INPUT} />
                    <FieldError msg={fieldErrors.firstName} />
                  </div>
                  <div>
                    <label className={LABEL}>Nom <span className="text-red-400">*</span></label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" className={INPUT} />
                    <FieldError msg={fieldErrors.lastName} />
                  </div>
                </div>

                <div>
                  <label className={LABEL}>Email</label>
                  <div className="relative">
                    <input value={invite.email} readOnly className={INPUT + ' bg-gray-50 text-gray-500 cursor-default pr-10'} />
                    <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Pré-rempli depuis votre invitation</p>
                </div>

                <div>
                  <label className={LABEL}>Téléphone <span className="text-red-400">*</span></label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+212 6XX XX XX XX" className={INPUT} />
                  <FieldError msg={fieldErrors.phone} />
                </div>

                <div>
                  <label className={LABEL}>Mot de passe <span className="text-red-400">*</span></label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" className={INPUT} />
                  {password && (
                    <div className="mt-1.5">
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: pwStr.width, background: pwStr.color }} />
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: pwStr.color }}>{pwStr.label}</p>
                    </div>
                  )}
                  <FieldError msg={fieldErrors.password} />
                </div>

                <div>
                  <label className={LABEL}>Confirmer <span className="text-red-400">*</span></label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className={INPUT} />
                  <FieldError msg={fieldErrors.confirm} />
                </div>

                <button type="button" onClick={nextStep}
                  className="w-full h-[44px] mt-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                  Continuer <ChevronRight size={15} />
                </button>
              </div>
            )}

            {/* ═══ Step 2 — Company ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-[16px] font-bold text-gray-900 mb-1">Informations entreprise</h2>

                <div>
                  <label className={LABEL}>Raison sociale <span className="text-red-400">*</span></label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" className={INPUT} />
                  <FieldError msg={fieldErrors.companyName} />
                </div>

                <div>
                  <label className={LABEL}>Secteur d'activité <span className="text-red-400">*</span></label>
                  <SearchableSelect options={SECTEURS_ACTIVITE} value={secteur} onChange={setSecteur} placeholder="Rechercher un secteur…" />
                  <FieldError msg={fieldErrors.secteur} />
                </div>

                <div>
                  <label className={LABEL}>Forme juridique <span className="text-red-400">*</span></label>
                  <SearchableSelect options={FORMES_JURIDIQUES} value={forme} onChange={setForme} placeholder="Rechercher une forme…" />
                  <FieldError msg={fieldErrors.forme} />
                </div>

                <div>
                  <label className={LABEL}>Régime fiscal <span className="text-red-400">*</span></label>
                  <SearchableSelect options={REGIMES_FISCAUX} value={regime} onChange={setRegime} placeholder="Rechercher un régime…" />
                  </select>
                  <FieldError msg={fieldErrors.regime} />
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 h-[44px] border border-gray-200 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <ChevronLeft size={15} /> Retour
                  </button>
                  <button type="button" onClick={nextStep}
                    className="flex-1 h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                    Continuer <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Step 3 — Fiscal IDs ═══ */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-[16px] font-bold text-gray-900 mb-1">Identifiants fiscaux</h2>
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="text-blue-500 text-[14px] mt-0.5">i</span>
                  <p className="text-[11px] text-blue-700">Ces informations sont obligatoires sur vos factures selon la loi marocaine (CGI & Loi 69-21). Vous pouvez les ajouter plus tard.</p>
                </div>

                <div>
                  <label className={LABEL}>ICE (15 chiffres)</label>
                  <input value={ice} onChange={e => setIce(e.target.value)} placeholder="000000000000000" maxLength={15} className={INPUT} />
                  <FieldError msg={fieldErrors.ice} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Identifiant Fiscal (IF)</label>
                    <input value={ifNumber} onChange={e => setIfNumber(e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Registre de Commerce (RC)</label>
                    <input value={rc} onChange={e => setRc(e.target.value)} className={INPUT} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Taxe Professionnelle (TP)</label>
                    <input value={tp} onChange={e => setTp(e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>CNSS</label>
                    <input value={cnss} onChange={e => setCnss(e.target.value)} className={INPUT} />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(2)}
                    className="flex-1 h-[44px] border border-gray-200 text-gray-600 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <ChevronLeft size={15} /> Retour
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                    {submitting ? 'Création…' : <><Check size={15} /> Créer mon compte</>}
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>

        <p className="text-center text-[12px] text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2 mb-6 justify-center">
      <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-[14px]">C</span>
      </div>
      <span className="text-[17px] font-bold text-gray-900 tracking-tight">ComptaFlow</span>
    </div>
  );
}
