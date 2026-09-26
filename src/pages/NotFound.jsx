import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link to="/dashboard" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  )
}
