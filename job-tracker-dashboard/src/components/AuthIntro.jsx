import { Link } from "react-router-dom";

export default function AuthIntro() {
  return (
    <aside className="auth-intro" aria-label="About ATrackie">
      <Link className="auth-home" to="/" aria-label="ATrackie home">
        <span className="brand-mark" aria-hidden="true">AT</span> ATrackie
      </Link>
      <p className="auth-intro-kicker">A little clarity for your next chapter</p>
      <h2>Remember the role.<br /><span>Be ready for what’s next.</span></h2>
      <p className="auth-intro-lead">Keep the jobs you applied for and the details that matter together—so a shortlist never catches you starting from scratch.</p>
      <ul className="auth-benefits">
        <li><span aria-hidden="true">01</span><div><strong>Capture while you browse</strong><p>Save job details with the Chrome extension.</p></div></li>
        <li><span aria-hidden="true">02</span><div><strong>Keep your progress in view</strong><p>Follow each application from applied to outcome.</p></div></li>
        <li><span aria-hidden="true">03</span><div><strong>Come back prepared</strong><p>Revisit the role, requirements, and original posting.</p></div></li>
      </ul>
      <Link className="auth-learn-link" to="/">Explore ATrackie <span aria-hidden="true">↗</span></Link>
    </aside>
  );
}
