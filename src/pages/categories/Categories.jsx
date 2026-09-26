import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Alert, { ErrorState } from '../../components/common/Alert'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import EmptyState from '../../components/common/EmptyState'
import Field from '../../components/common/Field'
import Modal from '../../components/common/Modal'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import { useAsync } from '../../hooks/useAsync'
import { useReferenceData } from '../../hooks/useReferenceData'
import { useToast } from '../../hooks/useToast'
import { categoryService } from '../../services/productService'
import { formatDate } from '../../utils/format'

function CategoryForm({ category, onSaved, onCancel }) {
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter a category name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = { name: name.trim(), description }
      onSaved(category ? await categoryService.update(category.id, payload) : await categoryService.create(payload))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Name" required>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Raw Materials" />
      </Field>
      <Field label="Description">
        <textarea className="input" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} />
      </Field>
      <div className="form-footer">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  )
}

export default function Categories() {
  const toast = useToast()
  const { refresh } = useReferenceData()
  const list = useAsync(() => categoryService.list(), [])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const afterChange = () => {
    list.reload()
    refresh()
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await categoryService.remove(deleting.id)
      toast.success(`${deleting.name} deleted.`)
      afterChange()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const columns = [
    { key: 'name', header: 'Category', render: (category) => <strong>{category.name}</strong> },
    { key: 'description', header: 'Description', render: (category) => category.description || <span className="muted">—</span> },
    {
      key: 'product_count',
      header: 'Products',
      align: 'right',
      render: (category) => <Link to={`/products?category_id=${category.id}`}>{category.product_count}</Link>,
    },
    { key: 'created_at', header: 'Created', render: (category) => formatDate(category.created_at) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (category) => (
        <div className="row-actions">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`} />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => setDeleting(category)}
            aria-label={`Delete ${category.name}`}
            title={category.product_count ? 'Move its products to another category first' : undefined}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="Categories"
        description="Group products for filtering and reporting."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <section className="card">
        {list.error ? (
          <div className="card-body">
            <ErrorState error={list.error} onRetry={list.reload} />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={list.data}
            loading={list.loading}
            caption="Categories"
            empty={<EmptyState icon={Tags} title="No categories yet" description="Create one to organise your products." />}
          />
        )}
      </section>

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'New category' : `Edit ${editing?.name}`} onClose={() => setEditing(null)} size="sm">
        {editing && (
          <CategoryForm
            category={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={(category) => {
              toast.success(editing === 'new' ? `${category.name} created.` : `${category.name} updated.`)
              setEditing(null)
              afterChange()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        message={
          deleting?.product_count
            ? `${deleting.name} still has ${deleting.product_count} product(s). Deleting will be refused until they are moved.`
            : 'This category is empty and will be removed.'
        }
        confirmLabel="Delete category"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
