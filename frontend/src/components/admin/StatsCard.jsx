import { 
  Calendar,
  HeartHandshake,
  Handshake,
  Gift,
  Package,
  FileText,
  Users,
  CheckCircle,
  Folder,
  AlertCircle,
  Heart,
  HelpingHand,
  Theater,
  Ban,
  Landmark,
  BarChart3,
  Check,
  XCircle,
  UserCheck,
  Coins,
  ClipboardList,
  LockOpen,
  Wrench,
  Contact,
  Link2,
  Star
} from "lucide-react";

const ICON_MAP = {
  "👵": <HeartHandshake size={22} />,
  "🤝": <Handshake size={22} />,
  "🎁": <Gift size={22} />,
  "📦": <Package size={22} />,
  "📅": <Calendar size={22} />,
  "📝": <FileText size={22} />,
  "👥": <Users size={22} />,
  "🟢": <CheckCircle size={22} style={{ color: "#2e7d32" }} />,
  "🗂️": <Folder size={22} />,
  "🗂": <Folder size={22} />,
  "🟡": <AlertCircle size={22} style={{ color: "#ed6c02" }} />,
  "💝": <Heart size={22} style={{ color: "#d32f2f" }} />,
  "🤲": <HelpingHand size={22} />,
  "🎭": <Theater size={22} />,
  "🚫": <Ban size={22} style={{ color: "#d32f2f" }} />,
  "🏛️": <Landmark size={22} />,
  "🏛": <Landmark size={22} />,
  "📊": <BarChart3 size={22} />,
  "✅": <Check size={22} />,
  "❌": <XCircle size={22} style={{ color: "#d32f2f" }} />,
  "🚶": <UserCheck size={22} />,
  "💰": <Coins size={22} />,
  "💸": <Coins size={22} />,
  "📋": <ClipboardList size={22} />,
  "🔓": <LockOpen size={22} />,
  "🔧": <Wrench size={22} />,
  "📇": <Contact size={22} />,
  "🔗": <Link2 size={22} />,
  "⭐": <Star size={22} />
};

export default function StatsCard({ title, value, subtitle, icon }) {
  const renderedIcon = typeof icon === "string" && ICON_MAP[icon] ? ICON_MAP[icon] : icon;
  
  return (
    <div className="stats-card">
      <div className="stats-icon">{renderedIcon}</div>
      <div>
        <h3>{title}</h3>
        <div className="stats-value">{value}</div>
        {subtitle && <div className="stats-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
