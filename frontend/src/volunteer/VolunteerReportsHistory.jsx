import VolunteerLayout from "@/components/volunteer/VolunteerLayout.jsx";
import VolunteerReportCard from "@/components/volunteer/VolunteerReportCard.jsx";

const REPORTS = [
  { date: "25.05.2026", elderly: "מרים לוי", type: "ביקור בית", status: "התקיים", followup: "לא", reportStatus: "אושר" },
  { date: "18.05.2026", elderly: "יוסף ברקוביץ", type: "שיחת טלפון", status: "התקיים", followup: "כן", reportStatus: "אושר" },
  { date: "10.05.2026", elderly: "חנה שטרן", type: "ליווי", status: "נדחה", followup: "לא", reportStatus: "ממתין" },
];

export default function VolunteerReportsHistory() {
  return (
    <VolunteerLayout title="הדוחות שלי" subtitle="צפייה בדוחות שנשלחו על ידך">
      {REPORTS.map((r, i) => <VolunteerReportCard key={i} {...r} />)}
    </VolunteerLayout>
  );
}
