import AdminLayout from "./AdminLayout.jsx";
import HeroTopbar from "./HeroTopbar.jsx";

/**
 * Reusable admin page layout with a hero header.
 *
 * Props:
 *  - title:      page title (shown on the right side of the hero)
 *  - subtitle:   short description under the title
 *  - actions:    React nodes (buttons) rendered on the right under the subtitle
 *  - heroImage:  background image URL for the hero. Each page can assign its
 *                own image; defaults to a shared placeholder.
 *  - children:   page content (stats, filters, tables...) rendered below hero
 */
export default function AdminPageLayout({
  title,
  subtitle,
  actions,
  heroImage = "/admin-heroes/default-hero.png",
  children,
}) {
  return (
    <AdminLayout hideTopbar>
      <section
        className="admin-hero"
        style={{ backgroundImage: `url('${heroImage}')` }}
      >
        <HeroTopbar />
        <div className="admin-hero-body">
          <div className="admin-hero-title">
            {title && <h1>{title}</h1>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="admin-hero-actions">{actions}</div>}
        </div>
      </section>
      {children}
    </AdminLayout>
  );
}
