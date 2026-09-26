from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Product
from ..schemas import CategoryCreate, CategoryOut, CategoryUpdate
from ..services.auth_service import get_current_user

router = APIRouter(prefix="/categories", tags=["Categories"], dependencies=[Depends(get_current_user)])


def _get(db, category_id):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found.")
    return category


def _product_count(db, category_id):
    return db.query(func.count(Product.id)).filter(Product.category_id == category_id).scalar()


def _ensure_unique_name(db, name, exclude_id=None):
    query = db.query(Category.id).filter(func.lower(Category.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    if query.first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"A category named '{name}' already exists.")


def _out(db, category):
    return CategoryOut(
        id=category.id,
        name=category.name,
        description=category.description,
        product_count=_product_count(db, category.id),
        created_at=category.created_at,
    )


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.query(Product.category_id, func.count(Product.id)).group_by(Product.category_id)
    )
    return [
        CategoryOut(
            id=category.id,
            name=category.name,
            description=category.description,
            product_count=counts.get(category.id, 0),
            created_at=category.created_at,
        )
        for category in db.query(Category).order_by(Category.name)
    ]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    _ensure_unique_name(db, data.name)
    category = Category(name=data.name, description=data.description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return _out(db, category)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    category = _get(db, category_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name"):
        _ensure_unique_name(db, changes["name"], exclude_id=category.id)
        category.name = changes["name"]
    if "description" in changes:
        category.description = changes["description"]
    db.commit()
    db.refresh(category)
    return _out(db, category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = _get(db, category_id)
    in_use = _product_count(db, category.id)
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"'{category.name}' is used by {in_use} product{'s' if in_use != 1 else ''}. "
            "Move them to another category first.",
        )
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
