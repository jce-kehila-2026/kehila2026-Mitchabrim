import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <h1 className="navbar-logo">Mitchabrim</h1>
        <ul className="navbar-links">
          <li><a href="#about">About</a></li>
          <li><a href="#activities">Activities</a></li>
          <li><a href="#join">Join Request</a></li>
          <li><Link to="/login">Admin Login</Link></li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;