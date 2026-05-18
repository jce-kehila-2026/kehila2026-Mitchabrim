function ProjectCard({ title, date, status, progress, delivered, onWay, packed }) {
  const statusLabels = {
    active: 'פעיל',
    completed: 'הושלם',
    planning: 'בתכנון'
  };

  return (
    <div className="project-card">
      <div className="project-card-header">
        <h3 className="project-card-title">{title}</h3>
        <span className={`status-badge status-${status}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="date">{date}</p>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="project-stats">
        <div className="stat-item">
          <span className="stat-number">{delivered}</span>
          <span className="stat-label">נמסרו</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{onWay}</span>
          <span className="stat-label">בדרך</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{packed}</span>
          <span className="stat-label">נארזו</span>
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;