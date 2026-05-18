import '../styles/public.css';

function Login() {
  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Admin Login</h2>
        <form className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" />
          </div>
          <button type="submit" className="signin-btn">Sign In</button>
        </form>
        <button className="google-signin-btn">Sign in with Google</button>
      </div>
    </div>
  );
}

export default Login;