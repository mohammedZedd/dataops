import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  TrendingUp,
  AlertTriangle,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StepStatus = "done" | "active" | "pending";

interface ProcessStep {
  number: number;
  label: string;
  sublabel: string;
  count: number;
  status: StepStatus;
}

interface ValidationBreakdown {
  label: string;
  count: number;
  dotClass: string;
}

interface RecentActivityItem {
  client: string;
  action: string;
  timeAgo: string;
  status: "done" | "pending";
}

export interface AccountingDashboardData {
  cabinetName: string;
  month: string;
  period: string;
  documentsReceived: number;
  progressPercent: number;
  steps: ProcessStep[];
  validationTotal: number;
  validationBreakdown: ValidationBreakdown[];
  recentActivity: RecentActivityItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Default mock data  (swap with real API data via props)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DATA: AccountingDashboardData = {
  cabinetName: "Cabinet Lefèvre",
  month: "Mars 2026",
  period: "1 – 31 mars 2026",
  documentsReceived: 47,
  progressPercent: 62,

  steps: [
    { number: 1, label: "Réception",   sublabel: "documents reçus", count: 47, status: "done"    },
    { number: 2, label: "Traitement",  sublabel: "pièces extraites", count: 38, status: "done"    },
    { number: 3, label: "Validation",  sublabel: "factures validées", count: 29, status: "active"  },
  ],

  validationTotal: 9,
  validationBreakdown: [
    { label: "Factures fournisseurs", count: 5, dotClass: "bg-blue-500"   },
    { label: "Factures clients",      count: 2, dotClass: "bg-violet-500" },
    { label: "Pièces incomplètes",    count: 2, dotClass: "bg-amber-500"  },
  ],

  recentActivity: [
    { client: "SARL Dupont Construction", action: "3 factures déposées",       timeAgo: "Il y a 12 min", status: "done"    },
    { client: "Cabinet Martin Conseil",   action: "1 facture à valider",        timeAgo: "Il y a 45 min", status: "pending" },
    { client: "Boulangerie Moreau",       action: "Clôture mensuelle effectuée",timeAgo: "Il y a 2h",     status: "done"    },
    { client: "Tech Innovations SAS",     action: "5 factures en attente",      timeAgo: "Il y a 3h",     status: "pending" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const CARD_SHADOW = "0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.04)";

const STEP_CONFIG: Record<StepStatus, {
  dot: string;
  numberText: string;
  countText: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  icon: React.ReactNode;
  cardBg: string;
  cardBorder: string;
}> = {
  done: {
    dot:         "bg-blue-600",
    numberText:  "text-white",
    countText:   "text-blue-600",
    badgeBg:     "bg-blue-50",
    badgeText:   "text-blue-700",
    label:       "Complété",
    icon:        <CheckCircle2 size={11} />,
    cardBg:      "bg-blue-50/50",
    cardBorder:  "border-blue-100",
  },
  active: {
    dot:         "bg-amber-500",
    numberText:  "text-white",
    countText:   "text-amber-600",
    badgeBg:     "bg-amber-50",
    badgeText:   "text-amber-700",
    label:       "En cours",
    icon:        <Clock size={11} />,
    cardBg:      "bg-amber-50/50",
    cardBorder:  "border-amber-100",
  },
  pending: {
    dot:         "bg-gray-200",
    numberText:  "text-gray-400",
    countText:   "text-gray-300",
    badgeBg:     "bg-gray-100",
    badgeText:   "text-gray-400",
    label:       "En attente",
    icon:        null,
    cardBg:      "bg-gray-50",
    cardBorder:  "border-gray-100",
  },
};

function getTodayFR(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── DashboardHeader ───────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  cabinetName: string;
}

function DashboardHeader({ cabinetName }: DashboardHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
          Tableau de bord
        </p>
        <h1 className="text-[22px] font-bold text-gray-900 leading-tight">
          {getGreeting()}, {cabinetName} 👋
        </h1>
        <p className="text-[13px] text-gray-400 mt-1 capitalize">{getTodayFR()}</p>
      </div>

    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

interface SummaryCardProps {
  month: string;
  period: string;
  documentsReceived: number;
  progressPercent: number;
  steps: ProcessStep[];
  onViewDocuments?: () => void;
}

function SummaryCard({
  month,
  period,
  documentsReceived,
  progressPercent,
  steps,
  onViewDocuments,
}: SummaryCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="p-6 sm:p-7">

        {/* ── Top row ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-7">

          {/* Left: title + subtitle */}
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">
              Suivi mensuel des pièces comptables
            </h2>
            <p className="text-[13px] text-gray-400 mt-1">
              {month}&nbsp;·&nbsp;
              <span className="font-medium text-gray-600">
                {documentsReceived} documents reçus
              </span>
            </p>
            <p className="text-[12px] text-gray-400 mt-0.5">{period}</p>
          </div>

          {/* Right: progress % + CTA */}
          <div className="flex items-center gap-5 sm:flex-shrink-0">
            <div className="text-right">
              <p className="text-[32px] font-bold text-blue-600 leading-none tabular-nums">
                {progressPercent}%
              </p>
              <p className="text-[11px] text-gray-400 mt-1">complétés ce mois</p>
            </div>
            <button
              onClick={onViewDocuments}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
            >
              Voir les documents
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-gray-500 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-gray-400" />
              Avancement du traitement
            </span>
            <span className="text-[12px] font-semibold text-blue-600">
              {progressPercent}% validés
            </span>
          </div>

          {/* Bar with stage separators */}
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, #1A56DB 0%, #60a5fa 100%)",
              }}
            />
            {/* Stage separators at 1/3 and 2/3 */}
            <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: "33.3%" }} />
            <div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: "66.6%" }} />
          </div>

          {/* Stage labels under bar */}
          <div className="flex justify-between mt-2">
            {["Réception", "Traitement", "Validation"].map((lbl) => (
              <span key={lbl} className="text-[10px] font-medium text-gray-400">
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* ── 3 steps ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {steps.map((step) => {
            const cfg = STEP_CONFIG[step.status];
            return (
              <div
                key={step.number}
                className={`rounded-xl p-4 border ${cfg.cardBg} ${cfg.cardBorder}`}
              >
                {/* Step number + status badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`h-6 w-6 rounded-full ${cfg.dot} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className={`text-[10px] font-bold leading-none ${cfg.numberText}`}>
                      {step.number}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>

                {/* Label */}
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  {step.label}
                </p>

                {/* Count */}
                <p className={`text-[28px] font-bold tabular-nums leading-none ${cfg.countText}`}>
                  {step.count}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">{step.sublabel}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ValidationCard ────────────────────────────────────────────────────────────

interface ValidationCardProps {
  total: number;
  breakdown: ValidationBreakdown[];
  onViewAll?: () => void;
}

function ValidationCard({ total, breakdown, onViewAll }: ValidationCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={15} className="text-amber-500" />
          </div>
          <h2 className="text-[13px] font-semibold text-gray-800">Factures à valider</h2>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
          >
            Voir tout
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Big number */}
      <div className="flex items-baseline gap-2.5 mb-5">
        <span className="text-[44px] font-bold text-gray-900 tabular-nums leading-none">
          {total}
        </span>
        <span className="text-[13px] text-gray-400 leading-tight">
          facture{total > 1 ? "s" : ""}<br />en attente
        </span>
      </div>

      {/* Breakdown */}
      <div className="mt-auto space-y-1.5">
        {breakdown.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.dotClass}`} />
              <span className="text-[13px] text-gray-600">{item.label}</span>
            </div>
            <span className={`text-[13px] font-bold tabular-nums ${
              item.count > 0 ? "text-gray-900" : "text-gray-300"
            }`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ActivityCard ──────────────────────────────────────────────────────────────

interface ActivityCardProps {
  items: RecentActivityItem[];
  onViewAll?: () => void;
}

function ActivityCard({ items, onViewAll }: ActivityCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileText size={15} className="text-blue-500" />
          </div>
          <h2 className="text-[13px] font-semibold text-gray-800">Activité récente</h2>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
          >
            Tout voir
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Activity list */}
      <div className="flex-1 space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-2 py-2.5 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {/* Status icon */}
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                item.status === "done" ? "bg-emerald-50" : "bg-amber-50"
              }`}
            >
              {item.status === "done" ? (
                <CheckCircle2 size={13} className="text-emerald-500" />
              ) : (
                <Clock size={13} className="text-amber-500" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-800 truncate">{item.client}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{item.action}</p>
            </div>

            {/* Time */}
            <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
              {item.timeAgo}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      {onViewAll && (
        <div className="mt-4 pt-4 border-t border-gray-50">
          <button
            onClick={onViewAll}
            className="w-full flex items-center justify-center gap-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Voir toute l'activité
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  data?: AccountingDashboardData;
  onViewDocuments?: () => void;
  onViewAllValidation?: () => void;
  onViewAllActivity?: () => void;
}

export default function AccountingDashboardHome({
  data = DEFAULT_DATA,
  onViewDocuments,
  onViewAllValidation,
  onViewAllActivity,
}: Props) {
  return (
    <div className="space-y-5">

        {/* 1 — Header */}
        <DashboardHeader cabinetName={data.cabinetName} />

        {/* 2 — Main summary card */}
        <SummaryCard
          month={data.month}
          period={data.period}
          documentsReceived={data.documentsReceived}
          progressPercent={data.progressPercent}
          steps={data.steps}
          onViewDocuments={onViewDocuments}
        />

        {/* 3 — Two cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ValidationCard
            total={data.validationTotal}
            breakdown={data.validationBreakdown}
            onViewAll={onViewAllValidation}
          />
          <ActivityCard
            items={data.recentActivity}
            onViewAll={onViewAllActivity}
          />
        </div>
    </div>
  );
}
