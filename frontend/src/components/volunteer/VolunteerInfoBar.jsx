export default function VolunteerInfoBar({ name = "—", area = "—", coordinator = "—", tasks = 0 }) {
  return (
    <div className="vol-info-bar">
      <div className="vol-info-item"><label>שם מתנדב/ת</label><div>{name}</div></div>
      <div className="vol-info-item"><label>אזור פעילות</label><div>{area}</div></div>
      <div className="vol-info-item"><label>רכז/ת אחראי/ת</label><div>{coordinator}</div></div>
      <div className="vol-info-item"><label>משימות פעילות</label><div>{tasks}</div></div>
    </div>
  );
}