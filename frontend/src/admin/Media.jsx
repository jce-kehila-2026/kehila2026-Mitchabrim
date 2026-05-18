import AdminLayout from '../components/admin/AdminLayout';
import '../styles/admin.css';

function Media() {
  const images = [
    { title: 'מפגש פרלמנט רחביה', category: 'פרלמנטים', date: '15/04/2026' },
    { title: 'חלוקת חבילות פסח', category: 'חגים', date: '10/04/2026' },
    { title: 'מתנדבים בקהילה', category: 'מתנדבים', date: '05/04/2026' },
    { title: 'כרטיס ברכה לפסח', category: 'כרטיסי ברכה', date: '01/04/2026' },
    { title: 'מפגש חברתי', category: 'שיווק', date: '20/03/2026' },
    { title: 'חלוקת מתנות', category: 'חגים', date: '25/03/2026' },
    { title: 'פרלמנט גבעת שאול', category: 'פרלמנטים', date: '18/03/2026' },
    { title: 'צוות מתחברים', category: 'מתנדבים', date: '12/03/2026' }
  ];

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">מאגר תמונות</h1>
        <p className="page-subtitle">ניהול תמונות לפי נושאים</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary">העלאת תמונה</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-secondary">פרלמנטים</button>
        <button className="btn btn-secondary">מתנדבים</button>
        <button className="btn btn-secondary">חגים</button>
        <button className="btn btn-secondary">שיווק</button>
        <button className="btn btn-secondary">כרטיסי ברכה</button>
      </div>

      <div className="media-gallery">
        {images.map((image, index) => (
          <div key={index} className="media-card">
            <div className="media-image">🖼️</div>
            <div className="media-info">
              <h4 className="media-title">{image.title}</h4>
              <p className="media-category">{image.category}</p>
              <p className="media-date">{image.date}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

export default Media;