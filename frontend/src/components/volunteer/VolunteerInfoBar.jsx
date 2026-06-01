export default function VolunteerInfoBar({ name = "דניאלה כץ", area = "גילה", coordinator = "שרה כהן", tasks = 2 }) {
  return (
    <div className="vol-info-bar">
      <div className="vol-info-item"><label>שם מתנדבת</label><div>{name}</div></div>
      <div className="vol-info-item"><label>אזור פעילות</label><div>{area}</div></div>
      <div className="vol-info-item"><label>רכזת אחראית</label><div>{coordinator}</div></div>
      <div className="vol-info-item"><label>משימות פעילות</label><div>{tasks}</div></div>
    </div>
  );
}
