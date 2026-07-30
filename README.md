# Mitchabrim — מתחברים

A web platform designed to present the organization’s activities and efficiently manage its operational data, volunteers, beneficiaries, projects, reports, and public content.

## Contents

- [Overview](#overview)
- [Non-Profit](#non-profit)
- [Team](#team)
- [Technology](#technology)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Privacy and Security](#privacy-and-security)
- [Known Limitations](#known-limitations)
- [Contacts](#contacts)
- [License and Ownership](#license-and-ownership)

## Overview

Mitchabrim is a community-driven platform dedicated to reducing social isolation among elderly citizens by connecting them with volunteers, community activities, and ongoing personal support.

The platform combines three main areas:

- A public website that presents the initiative, its activities, partners, team, gallery, and contact information.
- An administration portal for managing elderly citizens, volunteers, groups, projects, activities, reports, tasks, organizations, financial records, and website content.
- A volunteer portal for viewing assigned tasks, submitting reports, reviewing previous reports, and requesting profile updates.

The system helps the organization centralize its operational information and manage its daily work in a structured and accessible way.

## Non-Profit

- **Organization:** Mitchabrim — מתחברים
- **Main deliverable:** Web platform for public presentation and internal management
- **Primary users:** Organization staff, volunteers, and public visitors
- **Primary beneficiaries:** Elderly citizens participating in the initiative

The platform was developed to support the organization’s ongoing community work and reduce reliance on disconnected files and manual processes.

## Team

| Role | Name | Email | GitHub |
|---|---|---|---|
| Team Lead | Ahmad Bakri | ahmadbak@post.jce.ac.il | [Ahmad-Bakrii](https://github.com/Ahmad-Bakrii) |
| Developer | Ahmad Abu Kteash | ahmadabk@post.jce.ac.il | [Ahmad-AbuKteash](https://github.com/Ahmad-AbuKteash) |
| Developer | Bahaa Aqel | bahaaaq@post.jce.ac.il | [Bahaa-Aqel](https://github.com/Bahaa-Aqel) |
| Developer | Omar Aqel | omaraq@post.jce.ac.il | [Omar-Aqel](https://github.com/Omar-Aqel) |
| Developer | Omar Quttaineh | omarko@post.jce.ac.il | [OmarQuttaineh94](https://github.com/OmarQuttaineh94) |

## Technology

The platform is implemented as a single-page web application using:

- **React 18** for user interfaces.
- **Vite 5** for development and production builds.
- **React Router** for navigation between the public website, administration portal, and volunteer portal.
- **Firebase Authentication** for login and account management.
- **Cloud Firestore** for operational data.
- **Cloud Storage** for images and files.
- **Firebase Hosting** for deployment.
- **Cloud Functions** for protected server-side operations.
- **Node.js 22** for the cloud functions runtime.

## Quick Start

### Requirements

- Git
- Node.js
- npm
- Firebase CLI when deployment is required
- A local environment file with the required Firebase configuration

### Clone the repository

```powershell
git clone https://github.com/jce-kehila-2026/kehila2026-Mitchabrim.git
cd kehila2026-Mitchabrim
```

### Install dependencies

```powershell
npm.cmd install --prefix frontend
npm.cmd install --prefix frontend/functions
```

### Create the local environment file

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

Obtain the required values from the current Firebase project owner through a secure channel.

Do not commit `.env.local`, passwords, API keys, tokens, or other secrets to GitHub.

### Run locally

```powershell
npm.cmd --prefix frontend run dev
```

Vite will print the local development URL in the terminal.

### Build for production

```powershell
npm.cmd --prefix frontend run build
```

### Preview the production build

```powershell
npm.cmd --prefix frontend run preview
```

## Deployment

- **Deployed application:** https://mitchabrim-jce2026.web.app/
- **Hosting provider:** Firebase Hosting
- **Repository:** https://github.com/jce-kehila-2026/kehila2026-Mitchabrim
- **Wiki:** https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki

Before deployment:

1. Review and test the changes locally.
2. Build the production version.
3. Confirm that the correct Firebase project is selected.
4. Deploy only the resource that changed.
5. Verify the affected pages and functions after deployment.

Hosting deployment:

```powershell
cd frontend
npx.cmd firebase-tools deploy --only hosting --project mitchabrim-jce2026
```

## Documentation

Project documentation is maintained in the GitHub Wiki.

### Main Documentation

- [Wiki Home](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki)
- [Project-Overview](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Project-Overview)
- [User-Guide](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/User-Guide)
- [Architecture-and-Design](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Architecture-and-Design)
- [Installation-and-Maintenance](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Installation-and-Maintenance)
- [Permissions-and-Security](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Permissions-Security)

### Additional Documentation

- [Risk-Assessment](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Risk-Assessment)
- [System-Requirements](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/System-Requirements)
- [Test-Plan](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Test-Plan)
- [Use-Case-Documentation](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Use-Case-Documentation)

## Privacy and Security

The platform processes operational and personal information related to elderly citizens, volunteers, users, contacts, reports, tasks, projects, and uploaded files.

For this reason:

- Access must be limited according to the user’s role.
- Each administrator and developer must use an individual account.
- Passwords and administrator accounts must not be shared.
- Environment files, secrets, API keys, and tokens must never be committed to the repository.
- Production data must not be copied to personal devices unless it is required and authorized.
- Real personal data should not be used in testing when test data can be used instead.
- Screenshots containing personal information should not be published in public documentation.
- Access to GitHub, Firebase, and external services should be reviewed regularly.
- Access should be removed when a staff member or developer no longer needs it.
- Sensitive changes should be tested before deployment.
- Backups should be considered before major data changes.

More information is available in the Wiki page:

[Permissions and Security](https://github.com/jce-kehila-2026/kehila2026-Mitchabrim/wiki/Permissions-Security)

## Known Limitations

- The system is a web application and does not currently include a separate mobile application.
- Some operational tasks still depend on manual review by organization staff.
- Documentation should be updated whenever the project structure, deployment process, or external services change.
- The current application uses the Firebase Hosting URL unless a custom domain is configured in the future.

## Contacts

- **Project lead:** Ahmad Bakri — ahmadbak@post.jce.ac.il
- **Organization contact:** 052-6993404 — zavdazkyjudit@gmail.com
- **Instructor / TA:** Noa Carnial — noaca@post.jce.ac.il

Contact information should be reviewed before final publication to ensure that it is still current and approved.

## License and Ownership

The final ownership and permitted use of the project should follow the agreement between the development team, the academic institution, and the organization.

The organization should retain appropriate access to:

- The GitHub repository.
- Firebase.
- Hosting.
- Billing.
- Any custom domain.
- Any external service required for continued operation.

## Last Updated

July 2026
