import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, description, actions, back }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        {back && (
          <Link to={back.to} className="back-link">
            <ArrowLeft size={14} aria-hidden="true" /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
