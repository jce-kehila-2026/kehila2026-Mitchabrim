function JoinRequestSection() {
  return (
    <section id="join" className="join-request-section">
      <div className="container">
        <h2>Join Request</h2>
        <form className="join-form">
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input type="text" id="fullName" name="fullName" />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input type="tel" id="phone" name="phone" />
          </div>
          <div className="form-group">
            <label htmlFor="requestType">Request Type</label>
            <select id="requestType" name="requestType">
              <option value="volunteer">I want to volunteer</option>
              <option value="details">I want to hear more details</option>
              <option value="connect">I want to connect an elderly person</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="additionalInfo">Additional Information</label>
            <textarea id="additionalInfo" name="additionalInfo"></textarea>
          </div>
          <button type="submit" className="submit-btn">Submit</button>
        </form>
      </div>
    </section>
  );
}

export default JoinRequestSection;