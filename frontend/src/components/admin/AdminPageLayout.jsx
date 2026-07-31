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
  heroImage = "/admin-heroes/dashboard_hero.webp",
  heroImageMobile,
  children,
}) {
  const mobileImage =
    heroImageMobile ||
    (heroImage.startsWith("/admin-heroes/")
      ? heroImage.replace(/\.webp$/, "-mobile.webp")
      : heroImage);

  return (
    <AdminLayout hideTopbar>
      <section
        className="admin-hero"
        style={{
          "--admin-hero-image": `url('${heroImage}')`,
          "--admin-hero-mobile-image": `url('${mobileImage}')`,
        }}
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
